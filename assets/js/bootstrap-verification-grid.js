import { BawApi } from "/js/baw-api.js";

let bawApi = new BawApi("https://api.staging.ecosounds.org");
const gridElements = document.querySelectorAll("oe-verification-grid");

async function bootstrapVerificationGrid(target) {
    // TODO: this event name should be inlined by the microsite config
    const callback = await bawApi.eventCallback("Abbott's Babbler");
    target.getPage = callback;

    target.addEventListener("decision-made", (event) => {
        const decisions = event.detail;
        for (const decision of decisions) {
            bawApi.upsertVerification(decision);
        }
    });
}

async function updateUrlTransformers() {
    for (const element of gridElements) {
        element.urlTransformer = bawApi.createUrlTransformer();

        // restart the verification task to explicitly reset the
        // verification task back to the start and regenerate all of the
        // spectrograms.
        //
        // TODO: Remove this hack once upstream bugs are fixed
        // see: https://github.com/ecoacoustics/web-components/issues/333
        element.subjects = [];
    }
}

async function setup() {
    for (const element of gridElements) {
        bootstrapVerificationGrid(element);
    }

    const authElement = document.getElementById("auth-token-input");

    // This sl-change event will only trigger when enter is pressed.
    // I created this UI to test and serve as an example on how to use the
    // BawApi service.
    //
    // TODO: when we refactor the authentication UI, we might want to use a
    // html <form> element and listen for a submit event instead.
    authElement.addEventListener("sl-change", (event) => {
        const value = event.target.value;
        bawApi.authToken = value;
        updateUrlTransformers();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setup();
});
