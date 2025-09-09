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
 * A callback that can be used to get the current global WorkbenchApi instance
 */
globalThis.workbenchApi ??= () =>
    WorkbenchApi.instance(globalThis.siteParams.apihost);

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
    /**
     * You should not be using this constructor directly, and should instead get
     * and instance of this service through the WorkbenchApi.instance function
     * to get a initialized singleton instance of this service.
     *
     * @private
     * @param {string} host
     */
    constructor(host) {
        // guard doubles as a type check to ensure that the host is a string
        if (host === undefined) {
            throw new Error("apiHost is not defined.");
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

    /** @type {WorkbenchApi} */
    static #instance;

    /**
     * Gets a singleton instance of the workbench api service configured with
     * the login state pre-configured.
     *
     * @param {string} host
     * @returns {WorkbenchApi}
     */
    static async instance(host) {
        const makeInstance = async () => {
            const newInstance = new WorkbenchApi(host);
            await newInstance.#refreshAuthToken();
            return newInstance;
        };

        if (!WorkbenchApi.#instance) {
            WorkbenchApi.#instance = makeInstance();
        }

        return await WorkbenchApi.#instance;
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

    /**
     * A tag cache that stores tag ids and their model resolvers in a map.
     * We use a promise as the value so that we can store pending responses in
     * the cache.
     *
     * Note that because the tag cache is a map, it is in-memory and not
     * persistent between sessions or users.
     *
     * @type {Map<number, Response<Tag>>}
     */
    #tagCache = new Map();

    /** @returns {Promise<boolean>} */
    async isLoggedIn() {
        await this.#refreshAuthToken();
        return this.#authToken !== null;
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

        this.#authToken = null;

        const responseBody = await response.json();
        return responseBody;
    }

    /**
     * Authenticates the user using a username and password combination.
     * This function will return a boolean indicating if authentication was
     * successful.
     *
     * Note that this method does not refresh the authentication token because
     * after logging in, the user will typically navigate to another page,
     * causing the service to re-init (which will refresh the auth token).
     * This is an optimization decision that was made to minimize making an API
     * requests.
     *
     * @param {string} username
     * @param {string} password
     *
     * @returns {Promise<boolean>}
     */
    async loginUser(username, password) {
        // We don't send "Authentication" headers during login because we might
        // be refreshing the authentication token if the user is trying to log
        // in to a stale session.
        const signInEndpoint = this.#createUrl("/my_account/sign_in");
        const authTokenRequest = await this.#fetch(
            "GET",
            signInEndpoint,
            null,
            { Accept: "text/html" },
            false,
        );

        if (!authTokenRequest.ok) {
            return false;
        }

        const page = await authTokenRequest.text();
        const authenticityToken = page.match(
            /name="authenticity_token" value="(.+?)"/,
        );

        const requestBody = new FormData();
        requestBody.append("user[login]", username);
        requestBody.append("user[password]", password);
        requestBody.append("commit", "Log+in");
        requestBody.append("authenticity_token", authenticityToken[1]);

        const signInResponse = await this.#fetch(
            "POST",
            signInEndpoint,
            requestBody,
            { Accept: "text/html" },
            false,
        );

        return signInResponse.ok;
    }

    /**
     * @param {number} tagId
     * @returns {Promise<Tag | null>}
     */
    async getTag(tagId) {
        // We use "get" instead of "has" here to check if the tag is already in
        // the cache so that if it does exist, we don't have to do a subsequent
        // get call.
        //
        // If multiple requests for the same tag come close together, we cache
        // the response handler so that subsequent requests for the same tag can
        // await the same response.
        const cachedTag = this.#tagCache.get(tagId);
        if (cachedTag) {
            return await cachedTag;
        }

        const tagRequest = async () => {
            const url = this.#createUrl(`/tags/${tagId}`);
            const response = await this.#fetch("GET", url);
            const responseBody = await response.json();
            return responseBody.data;
        };

        const tagPromise = tagRequest();
        this.#tagCache.set(tagId, tagPromise);

        return await tagPromise;
    }

    /**
     * Fetches an audio event from the API using an audio recording and audio
     * event id.
     *
     * @param {number} audioRecordingId
     * @param {number} audioEventId
     * @returns {Promise<AudioEvent>}
     */
    async getAudioEvent(audioRecordingId, audioEventId) {
        const url = this.#createUrl(
            `/audio_recordings/${audioRecordingId}/audio_events/${audioEventId}`,
        );

        const response = await this.#fetch("GET", url);
        const responseBody = await response.json();

        return responseBody.data;
    }

    /**
     * Fetches an audio recording model from the API using an audio recording id
     *
     * @param {number} audioRecordingId
     * @returns {Promise<AudioRecording>}
     */
    async getAudioRecording(audioRecordingId) {
        const url = this.#createUrl(`/audio_recordings/${audioRecordingId}`);

        const response = await this.#fetch("GET", url);
        const responseBody = await response.json();

        return responseBody.data;
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
     * Deletes a verification object from the server using the audio event id
     * (subject id) + tag id as a unique identifier.
     *
     * @param {SubjectWrapper} model - The verification object to create
     * @returns {Promise<boolean>} - A boolean value indicating whether the verification was created successfully
     */
    async deleteVerification(model) {
        const audioEventId = model.subject.id;
        const tagId = model.tag.id;
        const currentUserId = (await this.getUserProfile())?.data?.id;

        const filterEndpoint = this.#createUrl(`/verifications/filter`);
        const getVerification = await this.#fetch("POST", filterEndpoint, {
            filter: {
                audio_event_id: { eq: audioEventId },
                tag_id: { eq: tagId },
                creator_id: { eq: currentUserId },
            },
            paging: {
                items: 1,
            },
        });

        if (!getVerification.ok) {
            throw new Error("Failed to fetch verification to delete");
        }

        const responseBody = await getVerification.json();
        const verification = responseBody.data[0];

        if (!verification) {
            throw new Error("Failed to find verification to delete");
        }

        const verificationId = verification.id;
        const deleteEndpoint = this.#createUrl(
            `/verifications/${verificationId}`,
        );

        const response = await this.#fetch("DELETE", deleteEndpoint);
        return response.ok;
    }

    /**
     * Fetches a verification object from the API
     *
     * @param {string} tag
     * @returns {() => Promise<AudioEvent[]>}
     */
    getVerificationCallback(filterBody) {
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

            // Increment the page number before making the audio_events filter
            // request so that if the callback is invoked while the request is
            // pending, there will not be a double-fetch.
            page = page + 1;

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

                model.tag = tag;
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
     * Efficiently queries the total number of items that match a filter
     * condition.
     *
     * @param {string} path - The endpoint to perform a filter request (without the /filter suffix)
     * @param {Record<string, unknown>} filterBody
     * @returns {Promise<Response<Record<PropertyKey, unknown>>>}
     */
    async itemCount(path, filterBody) {
        const endpoint = this.#createUrl(`${path}/filter`);

        const countFilter = {
            filter: filterBody,
            paging: {
                items: 1,
            },
        };

        const response = await this.#fetch("POST", endpoint, countFilter);
        const responseBody = await response.json();

        return responseBody.meta.paging.total;
    }

    /**
     * @description
     * Creates a callback that can be used by the oe-verification-grid
     * components `urlTransformer`.
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

        /**
         * @param {string} _url
         * @param {AudioEvent} subject
         * @returns {string}
         */
        return (_url, subject) => {
            return this.audioEventUrl(subject);
        };
    }

    /**
     * @param {AudioEvent} audioEvent
     * @returns {string}
     */
    audioEventUrl(audioEvent) {
        const recordingId = audioEvent.audio_recording_id;
        const start = audioEvent.start_time_seconds;
        const end = audioEvent.end_time_seconds;

        const urlBase = this.#createUrl(
            `/audio_recordings/${recordingId}/media.flac`,
        );
        const params = `?start_offset=${start}&end_offset=${end}`;
        const url = urlBase + params;

        return this.#withUserToken(url);
    }

    /**
     * Refreshes the authentication token by using exiting cookies to
     * authenticate.
     *
     * @returns {Promise<boolean>}
     * A boolean indicating if the auth token was successfully fetched
     */
    async #refreshAuthToken() {
        const securityEndpoint = this.#createUrl("/security/user");
        const response = await this.#fetch(
            "GET",
            securityEndpoint,
            undefined,
            undefined,
            false,
        );
        if (!response.ok) {
            return false;
        }

        const responseBody = await response.json();
        const authToken = responseBody.data.auth_token;
        this.#authToken = authToken;

        return true;
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
        const tagId = model.tag.id;

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
     * Adds a user authentication token to a url as a query parameter.
     *
     * @param {string} url
     * @returns {string}
     */
    #withUserToken(url) {
        if (!this.#authToken) {
            return url;
        }

        // We use a URL object so that if the url already has query parameter,
        // it will be added using a "&" instead of a "?".
        // Using a URL object also automatically handles encoding the query
        // parameter.
        //
        // Note: This will throw an error if the url is not valid.
        const urlObj = new URL(url);
        urlObj.searchParams.append("user_token", this.#authToken);
        return urlObj.href;
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
    #fetch(
        method,
        url,
        body = null,
        headerOverride = {},
        withAuthHeader = true,
    ) {
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

        // If the "Authorization" header is omitted, the cookie will be used for
        // authorization.
        // This can be useful when refreshing the authentication token, or for
        // making requests where the auth token may have expired.
        if (this.#authToken && withAuthHeader) {
            headers["Authorization"] = `Token token=\"${this.#authToken}\"`;
        }

        if (method !== "GET") {
            if (typeof body === "object" && !(body instanceof FormData)) {
                headers["Content-Type"] = "application/json";
                body = JSON.stringify(body);
            }
        }

        // If the "fetch" function fails due to CORS or other security related
        // issues, it will throw an error instead of returning a "bad" response.
        return fetch(url, {
            method,
            headers,
            body,
            credentials: "include",
        }).catch((error) => {
            const errorMessage = `Failed to connect to the API.
Possible reasons:
    - API CORS headers are not configured to allow this origin
    - The API could not be contacted because you are not connected to the internet
    - The API is temporarily unavailable due to an internal error
`;

            throw new Error(errorMessage, error);
        });
    }
}
