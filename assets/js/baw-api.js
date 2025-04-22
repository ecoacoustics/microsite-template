/**
 * @typedef {Verification}
 *
 * @property {number} id
 * @property {string} confirmed
 * @property {number} audio_event_id
 * @property {number} tag_id
 *
 * @property {string} creator_id
 * @property {string} updater_id
 * @property {string} created_at
 * @property {string} updated_at
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

  /**
   * Fetches the current users profile from the API
   */
  async getUserProfile() {
    return await fetch(this.#createUrl("/my_account"));
  }

  /**
   * Fetches a verification object from the API
   *
   * @param {number} id - The ID of the verification object to fetch
   */
  async getVerifications() {
    const payload = {
      filter: {
        include: [
          {
            relation: "user",
            scope: {
              fields: ["id", "firstName", "lastName"],
            },
          },
          {
            relation: "verificationType",
            scope: {
              fields: ["id", "name"],
            },
          },
        ],
      },
    };

    return await fetch(this.#createUrl("/verifications/filter"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  async saveVerification() {}

  /**
   * Creates a new verification object on the server
   *
   * @param {Verification} model - The verification object to create
   */
  async upsertVerification(model) {
    const payload = {
      verification: model,
    };

    return await fetch(this.#createUrl("/verifications"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  /**
   * @param {string} path
   * @returns {string}
   */
  #createUrl(path) {
    return `${this.#host}${path}`;
  }
}
