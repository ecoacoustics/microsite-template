/**
 * A service to interact with the baw-api
 */
export class BawApi {
    /** @param {string} host */
    constructor(host) {
        // guard doubles as a type check to ensure that the host is a string
        if (!host.startsWith("http")) {
            throw new Error("Host must start with http or https");
        }

        this.#host = host;
    }

    /** @type {string} */
    #host;
    /** @type {number} */
    #page = 1;
    /** @type {string | null} */
    #authToken = null;

    /** @param {string} value */
    set authToken(value) {
        this.#authToken = value;
    }

    /**
     * Fetches the current users profile from the API
     * @returns {Promise<User>}
     */
    async getUserProfile() {
        const url = this.#createUrl("/my_account");
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
     * @param {number} verificationId
     * @returns {Promise<Verification>}
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
     * Creates a new verification object on the server
     *
     * @param {Verification} model - The verification object to create
     * @returns {Promise<boolean>} - A boolean value indicating whether the verification was created successfully
     */
    async upsertVerification(model) {
        const payload = {
            verification: model,
        };

        const url = this.#createUrl("/verifications");
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(payload),
        });

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

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            const responseBody = await response.json();
            const responseMeta = responseBody.meta;
            const eventModels = responseBody.data;
            const gridContext = {};

            // add the "tag" property to the event models
            eventModels.forEach((model) => {
                model.tag = tag;
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
                `/audio_recordings/${recordingId}/media.flac`
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
        return `${this.#host}${path}`;
    }
}
