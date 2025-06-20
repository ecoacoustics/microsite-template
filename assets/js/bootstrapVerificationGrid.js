const gridElements = () => document.querySelectorAll("oe-verification-grid");

/**
 * @description
 * Prepares a verification grid with the necessary config to contact the
 * baw-api and perform verification tasks.
 *
 * @param {VerificationGridComponent} target
 * @param {Record<string, unknown>} filterBody
 */
async function bootstrapVerificationGrid(target, filterBody) {
    // TODO: this event name and filter body should be pulled from the microsite
    // config file
    const callback = await window.workbenchApi.getVerificationCallback(
        filterBody,
    );
    target.getPage = callback;

    updateUrlTransformers(target);

    target.addEventListener("decision-made", (event) => {
        const decisions = event.detail;
        for (const decision of decisions) {
            // Each call to "upsertVerification" is an async fire and forget
            // call to the api.
            // Each request is an un-awaited async method call so that it
            // doesn't lock up the main thread and freeze the website when an
            // api call is made.
            //
            // If an upsert request errors or fails to be applied, there is no
            // retry logic, and the verification will fail to commit to the
            // database.
            window.workbenchApi.upsertVerification(decision);
        }
    });
}

/**
 * @description
 * Updates the verification grids urlTransformer which is used to add auth
 * tokens when downloading audio files.
 * This resets the verification grid task because a different user may have
 * access to different audio events or audio files.
 *
 * @param {VerificationGridComponent} target
 */
async function updateUrlTransformers(target) {
    target.urlTransformer = window.workbenchApi.createMediaUrlTransformer();

    // restart the verification task to explicitly reset the
    // verification task back to the start and regenerate all of the
    // spectrograms.
    //
    // TODO: Remove this hack once upstream bugs are fixed
    // see: https://github.com/ecoacoustics/web-components/issues/333
    target.subjects = [];
}

async function setup() {
    const campaigns = window.siteParams?.campaigns || [];
    // This guard condition is not exhaustive because it doesn't check every
    // element in the "campaigns" array.
    if (
        !Array.isArray(campaigns) ||
        campaigns.length === 0 ||
        typeof campaigns[0] !== "object"
    ) {
        console.error("'Campaigns' must be an array of objects");
        return;
    }

    const targetElements = gridElements();
    if (targetElements.length > 0) {
        const userModel = await window.workbenchApi.getUserProfile();
        if (!userModel) {
            window.location.href = "/login";
        }

        window.workbenchApi.authToken = userModel.authToken;
    }

    for (const element of targetElements) {
        // Retrieve the campaign name from the web component set in HTML/MD
        const campaignName = element.dataset.campaign;

        // Find the corresponding campaign configuration from hugo.yaml
        const campaign = campaigns.find((c) => c.name === campaignName);
        if (!campaign) {
            console.error(`No matching campaign found for ${campaignName}`);
            continue;
        }

        // Extract the filter settings from the campaign configuration (hugo.yaml)
        const filterBody = campaign.filters;
        if (!filterBody) {
            console.error(`Campaign ${campaign} does not have a filter body`);
            continue;
        }

        // Initialize the verification grid with the filter settings
        bootstrapVerificationGrid(element, filterBody);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setup();
});
