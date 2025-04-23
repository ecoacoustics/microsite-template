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

        this.host = host;
    }

    /** @type {string} */
    host;
    /** @type {number} */
    page = 1;
    /** @type {string | null} */
    authToken = null;

    set setAuthToken(value) {
        this.authToken = value;
    }

    /**
     * Fetches the current users profile from the API
     */
    async getUserProfile() {
        return await fetch(this.createUrl("/my_account"));
    }

    /**
     * Fetches a verification object from the API
     *
     * @param {string} tag
     * @returns {Promise<AudioEvent[]>}
     */
    async eventCallback(tag) {
        const url = this.createUrl("/audio_events/filter");

        const filterBody = {
            "tags.text": {
                eq: tag,
            },
        };

        return async () => {
            const pagingBody = {
                page: this.page,
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

            const callbackResponse = {
                subjects: eventModels,
                totalItems: responseMeta.paging.total,
                context: gridContext,
            };

            return callbackResponse;
        };
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

        const url = this.createUrl("/verifications");
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
     * @param {string} path
     * @returns {string}
     */
    createUrl(path) {
        return `${this.host}${path}`;
    }

    /** @returns {string} */
    createUrlTransformer() {
        return (_, model) => {
            const recordingId = model.audio_recording_id;
            const start = model.start_time_seconds;
            const end = model.end_time_seconds;

            return `${this.host}/audio_recordings/${recordingId}/media.flac?start_offset=${start}&end_offset=${end}&user_token=${this.authToken}`;
        };
    }
}
