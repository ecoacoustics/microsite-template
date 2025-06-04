import { WorkbenchApi } from "/js/workbenchApi.js";

let workbenchApi = new WorkbenchApi("https://api.staging.ecosounds.org");
const gridElements = document.querySelectorAll("oe-verification-grid");

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
    const callback = await workbenchApi.getVerificationCallback(filterBody);
    target.getPage = callback;

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
            workbenchApi.upsertVerification(decision);
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
    target.urlTransformer = workbenchApi.createMediaUrlTransformer();

    // restart the verification task to explicitly reset the
    // verification task back to the start and regenerate all of the
    // spectrograms.
    //
    // TODO: Remove this hack once upstream bugs are fixed
    // see: https://github.com/ecoacoustics/web-components/issues/333
    target.subjects = [];
}


async function setup() {

    const campaigns = window.siteParams?.campaign || [];
    // This guard condition is not exhaustive because it doesn't check every
    // element in the "campaigns" array.
    if (
    	!Array.isArray(campaigns) ||
    	campaigns.length === 0 ||
    	typeof campaigns[0] !== "string"
    ) {
    	console.error("'Campaigns' must be an array of strings");
    	return;
    }

    gridElements.forEach((element) => {
        // Retrieve the campaign name from the web component set in HTML/MD
        const campaignName = element.dataset.campaign;

        // Find the corresponding campaign configuration from hugo.yaml
        const campaign = campaigns.find(c => c.name === campaignName);
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
    });

    const authElement = document.getElementById("auth-token-input");
    
    // This sl-change event will only trigger when enter is pressed.
    // I created this UI to test and serve as an example on how to use the
    // BawApi service.
    //
    // TODO: when we refactor the authentication UI, we might want to use a
    // html <form> element and listen for a submit event instead.
    authElement.addEventListener("sl-change", (event) => {
        const value = event.target.value;
        workbenchApi.authToken = value;

        for (const invalidatedGrid of gridElements) {
            updateUrlTransformers(invalidatedGrid);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setup();
});
