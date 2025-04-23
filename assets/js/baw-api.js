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
 * const api = new BawApi("https://api.ecosounds.org");
 *  api.authToken = "your-auth-token";
 *
 * const user = await api.getUserProfile();
 * const verification = await api.getVerification(123);
 * ```
 */
export class BawApi {
    /** @param {string} host */
    constructor(host) {
        // guard doubles as a type check to ensure that the host is a string
        if (!host.startsWith("http")) {
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

    /** @type {number} */
    #page = 1;

    /**
     * An authentication token that will be added to all API requests.
     * If you want to set the auth token, you can use the "authToken" setter.
     *
     * If no auth token has been provided, the #authToken will be set to null.
     *
     * @type {string | null}
     */
    #authToken = null;

    /** @param {string} value */
    set authToken(value) {
        this.#authToken = value;
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
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        });

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
     * @returns {Promise<AudioEvent[]>}
     */
    async eventCallback(tag) {
        const url = this.#createUrl("/audio_events/filter");

        const filterBody = {
            "tags.text": {
                eq: tag,
            },
        };

        return async () => {
            const pagingBody = {
                page: this.#page,
                // I hard-locked the page size to 25 so that (if for some
                // reason) there is an api update that changes the page size
                // while the user is verifying results, nothing will break
                items: 25,
            };

            const payload = {
                filter: filterBody,
                paging: pagingBody,
            };

            const response = await this.#fetch("POST", url, payload);

            const responseBody = await response.json();
            const responseMeta = responseBody.meta;
            const eventModels = responseBody.data;
            const gridContext = {};

            // add the "tag" property to the event models
            eventModels.forEach((model) => {
                model.tag = model.taggings[0];
                model.tag.text = tag;
            });

            const callbackResponse = {
                subjects: eventModels,
                totalItems: responseMeta.paging.total,
                context: gridContext,
            };

            return callbackResponse;
        };
    }

    /** @returns {string} */
    createUrlTransformer() {
        return (_, model) => {
            const recordingId = model.audio_recording_id;
            const start = model.start_time_seconds;
            const end = model.end_time_seconds;
            const authToken = this.#authToken;

            const urlBase = this.#createUrl(
                `/audio_recordings/${recordingId}/media.flac`,
            );
            const params = `?start_offset=${start}&end_offset=${end}&user_token=${authToken}`;

            return urlBase + params;
        };
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
     * Converts a web component verification model to a baw-api verification
     * model that can be committed to the servers database.
     *
     * This method is private so that it is transparent to the rest of the
     * microsite.
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
     * A wrapped fetch() function that injects authentication information
     * and sends the sets the content type for JSON body's.
     *
     * @param {string} method
     * @param {string} url
     * @param {Record<string, unknown> | null} body
     *
     * @returns {Promise<Response>}
     */
    #fetch(method, url, body = null) {
        const headers = {
            Accept: "application/json",
        };

        if (this.#authToken) {
            headers["Authorization"] = `Token token=\"${this.#authToken}\"`;
        }

        // TODO: this does not support OPTION, HEAD, or DELETE requests
        if (method !== "GET") {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(body);
        }

        return fetch(url, {
            method,
            headers,
            body,
        });
    }
}
