/**
 * @typedef {Verification}
 *
 * @property {number}   id
 * @property {string}   confirmed
 * @property {number}   audio_event_id
 * @property {number}   tag_id
 *
 * @property {string}   creator_id
 * @property {string}   updater_id
 * @property {string}   created_at
 * @property {string}   updated_at
 */

/**
 * @typedef {AudioEvent}
 *
 * @property {number}   id;
 * @property {number}   audioRecordingId;
 * @property {number}   channel;
 * @property {number}   startTimeSeconds;
 * @property {number}   endTimeSeconds;
 * @property {number}   lowFrequencyHertz;
 * @property {number}   highFrequencyHertz;
 * @property {number}   durationSeconds;
 * @property {boolean}  isReference;
 * @property {number}   score;
 * @property {number}   provenanceId;
 * @property {number}   audioEventImportFileId;
 */

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
    #page;

    /**
     * Fetches the current users profile from the API
     */
    async getUserProfile() {
        return await fetch(this.#createUrl("/my_account"));
    }

    /**
     * Fetches a verification object from the API
     *
     * @param {string} tag
     * @returns {Promise<AudioEvent[]>}
     */
    async getEvents(tag) {
        const payload = {
            filter: {
                "tag.text": {
                    eq: tag,
                },
            },
            paging: {
                page: this.#page,
                // I hard-locked the page size to 25 so that (if for some
                // reason) there is an api update that changes the page size
                // while the user is verifying results, nothing will break
                page_size: 25,
            },
        };

        const url = this.#createUrl("/audio_events/filter");
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(payload),
        });

        return await response.json();
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
     * @param {string} path
     * @returns {string}
     */
    #createUrl(path) {
        return `${this.#host}${path}`;
    }
}
