// The decisions returned by the web components are not the same as the
// decisions recorded by the baw-api.
// This object maps web component decisions (key) to baw-api decisions (values).
// note: to prevent leaking internal details, this is not exported from this
// module, so I do not expect it to be used outside of this module.
const bawApiDecisionMapping = {
    true: "correct",
    false: "incorrect",
    unsure: "unsure",
    skip: "skip",
};

/**
 * A service to interact with the baw-api
 * Note: When contacting the baw-api, a lot of endpoints require authentication
 * therefore it is recommended that you set the authToken property before
 * calling any of the methods.
 *
 * ## Example usage
 *
 * ```js
 * const api = new WorkbenchApi("https://api.ecosounds.org");
 *  api.authToken = "your-auth-token";
 *
 * const user = await api.getUserProfile();
 * const verification = await api.getVerification(123);
 * ```
 */
export class WorkbenchApi {
    /** @param {string} host */
    constructor(host) {
        // guard doubles as a type check to ensure that the host is a string
        if (host === undefined) {
            throw new Error("hugo.yaml: 'apiHost' is not defined.");
        } else if (!host.startsWith("http")) {
            const errorMessage = `
                Api host must start with http or https.
                    Incorrect Example: api.ecosounds.org
                    Correct Example: https://api.ecosounds.org
            `;
            throw new Error(errorMessage);
        }

        this.#host = host;
    }

    /** @type {string} */
    #host;

    /**
     * An authentication token that will be added to all API requests.
     * If you want to set the auth token, you can use the "authToken" setter.
     *
     * If no auth token has been provided, the #authToken will be set to null.
     *
     * @type {string | null}
     */
    #authToken = null;

    /** @param {string | null} value */
    set authToken(value) {
        this.#authToken = value;
    }

    /** @returns {boolean} */
    get isAuthenticated() {
        return "";
    }

    /**
     * Fetches the current users profile from the API.
     * Calling this method requires an authentication token to be set.
     *
     * If no authentication token is set, or the authentication token is
     * invalid, this method will return "null".
     *
     * @returns {Promise<User | null>}
     */
    async getUserProfile() {
        const url = this.#createUrl("/my_account");
        const response = await this.#fetch("GET", url);
        if (!response.ok) {
            return null;
        }

        const responseBody = await response.json();
        return responseBody;
    }

    async logoutUser() {
        const url = this.#createUrl("/security");
        const response = await this.#fetch("DELETE", url);
        if (!response.ok) {
            return null;
        }

        const responseBody = await response.json();
        return responseBody;
    }

    /**
     * Authenticates the user using a username and password combination.
     * This function will return a boolean indicating if authentication was
     * successful.
     *
     * @returns {Promise<boolean>}
     */
    async authenticateUser() {
        const signInEndpoint = this.#createUrl("/my_account/sign_in");
        const initRequest = await this.#fetch("GET", signInEndpoint, null, {
            Accept: "*",
        });
        if (!initRequest.ok) {
            return false;
        }

        const page = await initRequest.text();
        const authenticityToken = page.match(
            /name="authenticity_token" value="(.+?)"/,
        );

        const formData = new FormData(form);
        const formValues = Object.fromEntries(formData);

        const urlParams = new URLSearchParams();
        urlParams.set("user[login]", formValues["user[login]"]);
        urlParams.set("user[password]", formValues["user[password]"]);
        urlParams.set("commit", "Log+in");
        urlParams.set("authenticity_token", authenticityToken[1]);

        const signInResponse = await this.#fetch(
            "POST",
            signInEndpoint,
            urlParams.toString(),
        );

        return signInResponse.ok;
    }

    /**
     * @param {number} tagId
     * @returns {Promise<Tag | null>}
     */
    async getTag(tagId) {
        const url = this.#createUrl(`/tags/${tagId}`);
        const response = await this.#fetch("GET", url);

        const responseBody = await response.json();
        return responseBody;
    }

    /**
     * Uses a verification model id to fetch the verification object from the
     * baw-api.
     * If there is no verification object with the given id, this method will
     * return null.
     *
     * @param {number} verificationId
     * @returns {Promise<BawVerification | null>}
     */
    async getVerification(verificationId) {
        const url = this.#createUrl(`/verifications/${verificationId}`);
        const response = await this.#fetch("GET", url);

        const responseBody = await response.json();
        return responseBody;
    }

    /**
     * Creates a new verification object on the server if it doesn't exist,
     * or updates the existing verification object already exists.
     *
     * @param {SubjectWrapper} model - The verification object to create
     * @returns {Promise<boolean>} - A boolean value indicating whether the verification was created successfully
     */
    async upsertVerification(model) {
        // convert the verification model to a baw-api compatible model
        // I do this here so that the entire app can have no knowledge of how
        // the baw-api model records verifications and they only have to deal
        // with the web components verification model.
        const bawModel = this.#verificationToBawModel(model);
        const payload = {
            verification: bawModel,
        };

        // associated api controller
        // https://github.com/QutEcoacoustics/baw-server/blob/master/app/controllers/verifications_controller.rb#L67-L79
        const url = this.#createUrl("/verifications");
        const response = await this.#fetch("PUT", url, payload);

        return response.ok;
    }

    /**
     * Fetches a verification object from the API
     *
     * @param {string} tag
     * @returns {() => Promise<AudioEvent[]>}
     */
    async getVerificationCallback(filterBody) {
        const url = this.#createUrl("/audio_events/filter");

        // we wrap the "page" variable in a closure so that only this callback
        // is stateful and the service can remain stateless.
        let page = 1;
        return async () => {
            const pagingBody = {
                // I hard-locked the page size to 25 so that (if for some
                // reason) there is an api update that changes the page size
                // while the user is verifying results, nothing will break
                items: 25,
                page,
            };

            const payload = {
                paging: pagingBody,
                ...filterBody,
            };

            const response = await this.#fetch("POST", url, payload);
            if (!response.ok) {
                console.error("Failed to fetch page of events");
                return {
                    subjects: [],
                    totalItems: 0,
                    context: {},
                };
            }

            const responseBody = await response.json();
            const responseMeta = responseBody.meta;
            const eventModels = responseBody.data;
            const gridContext = {};

            // add a "tag" model to every subject by fetching the tag of
            // interest
            const associatedModelPromises = eventModels.map(async (model) => {
                const taggings = model.taggings;
                if (taggings.length < 1) {
                    return;
                }

                const tagOfInterest = taggings[0];
                const tag = await this.getTag(tagOfInterest.tag_id);

                model.tag = tag.data;
            });

            await Promise.allSettled(associatedModelPromises);

            const callbackResponse = {
                subjects: eventModels,
                totalItems: responseMeta.paging.total,
                context: gridContext,
            };

            return callbackResponse;
        };
    }

    /**
     * @description
     * Creates a callback that can be used by the oe-verification-grid
     * components `urlTransformer` .
     * This URL converts a subject model (AudioEvent) into a baw-api endpoint
     * to download the segment of audio referenced by the audio event.
     *
     * This callback is defined in the web components subjectParser
     * @see https://github.com/ecoacoustics/web-components/blob/eb0c366/src/services/subjectParser.ts#L10
     *
     * @returns {() => string}
     */
    createMediaUrlTransformer() {
        // the "url" is not used in this callback because the original subject
        // model (AudioEvent model) does not have any of the "url" fields
        // supported by the web components.
        return (_url, subject) => {
            const recordingId = subject.audio_recording_id;
            const start = subject.start_time_seconds;
            const end = subject.end_time_seconds;
            const authToken = this.#authToken;

            const urlBase = this.#createUrl(
                `/audio_recordings/${recordingId}/media.flac`,
            );
            const params = `?start_offset=${start}&end_offset=${end}&user_token=${authToken}`;

            return urlBase + params;
        };
    }

    /**
     * Converts a web component verification model to a baw-api verification
     * model that can be committed to the servers database.
     *
     * The rest of the website should be working with the web component
     * verification model, and then this service should convert it to a baw-api
     * compatible model only before sending it to the server.
     *
     * @param {SubjectWrapper} model
     * @returns {BawVerification}
     */
    #verificationToBawModel(model) {
        const apiDecision = bawApiDecisionMapping[model.verification.confirmed];
        const tagId = model.tag.tag_id;

        const subject = model.subject;
        const apiModel = {
            audio_event_id: subject.id,
            tag_id: tagId,
            confirmed: apiDecision,
        };

        return apiModel;
    }

    /**
     * @param {string} path
     * @returns {string}
     */
    #createUrl(path) {
        // I use a URL constructor here so that a lot of edge cases are handled.
        // e.g. if the user adds a trailing slash to the host, or if they forget
        // to add the leading slash to the path will be automatically handled
        // by the URL constructor.
        const url = new URL(path, this.#host);
        return url.href;
    }

    /**
     * A wrapped fetch() function that injects authentication information
     * and sends the sets the content type for JSON body's.
     *
     * @param {string} method
     * @param {string} url
     * @param {Record<string, unknown> | FormData | null} body
     *
     * @returns {Promise<Response>}
     */
    #fetch(method, url, body = null, headerOverride = {}) {
        if (
            method !== "GET" &&
            method !== "POST" &&
            method !== "PUT" &&
            method !== "PATCH" &&
            method !== "DELETE"
        ) {
            throw new Error(
                `Fetch method: '${method}' is not supported by the baw-api service.`,
            );
        }

        const headers = {
            Accept: "application/json",
            ...headerOverride,
        };

        if (this.#authToken) {
            headers["Authorization"] = `Token token=\"${this.#authToken}\"`;
        }

        if (method !== "GET") {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(body);
        }

        // If the "fetch" function fails due to CORS or other security related
        // issues, it will throw an error instead of returning a "bad" response.
        try {
            return fetch(url, {
                method,
                headers,
                body,
                credentials: "include",
            });
        } catch (error) {
            const errorMessage = `Failed to connect to the API.
Possible errors:
    - API CORS headers are not configured to allow this origin
    - The API could not be contacted because you are not connected to the internet
    - The API is temporarily unavailable due to an internal error
`;

            throw new Error(errorMessage, error);
        }
    }
}
