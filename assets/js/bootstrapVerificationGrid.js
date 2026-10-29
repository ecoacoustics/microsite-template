import { combineFilters, createTagFilter } from "./filterHelpers.js";

const gridElements = () => document.querySelectorAll("oe-verification-grid");

const api = await workbenchApi();

// Allow a verify page to dynamically sub-select part of its campaign  
// to verify. We use this to focus on a subset (typically one) of the campaign's 
// tag_ids at at time.  
const focusQsp = new URLSearchParams(globalThis.location.search).get("focus");
const focusTagIDs = focusQsp
    ? focusQsp.split(",").map(Number).filter(Number.isInteger)
    : [];

/**
 * @description
 * Prepares a verification grid with the necessary config to contact the
 * baw-api and perform verification tasks.
 *
 * @param {VerificationGridComponent} target
 * @param {Record<string, unknown>} campaign
 * @param {number | null} currentUserID
 */
async function bootstrapVerificationGrid(target, campaign, currentUserID) {
  const campaignFilters = campaign?.filters;
  if (!campaignFilters?.filter) {
    console.error(`Campaign ${campaign?.name ?? "unknown"} does not have a filters set`);
    return;
  }

  const configuredTagIDs = Array.isArray(campaign.tag_ids)
    ? campaign.tag_ids.map(Number).filter(Number.isInteger)
    : [];
  
 
  const filterTagIDs = focusTagIDs.length > 0
    ? configuredTagIDs.filter((tagID) => focusTagIDs.includes(tagID))
    : configuredTagIDs;

  // const taskFilter = campaign.only_unverified === false
  //   ? {
  //       or: [
  //         { "verifications.creator_id": { not_eq: currentUserID } },
  //         { "verifications.id": { eq: null } },
  //         {
  //           and: [
  //             { "verifications.creator_id": { eq: currentUserID } },
  //             { "verifications.confirmed": { eq: "skip" } },
  //           ],
  //         },
  //       ],
  //     }
  //   : { verification_count: { eq: 0 } };

  // TODO: to not exclude skipped verifications, we need to either 
  // not filter events on verifications at all and use a second filter on verifications to exclude those that were verified not including skip
  // OR wait for an update for the API to scope filters by related models
  // The above filter does not work, filters on has-many relationships are done with independed subqueries
  const taskFilter = campaign.only_unverified === false
    ? {
        "not": {"verifications.creator_id": { "eq": currentUserID }}
      }
    : { verification_count: { eq: 0 } };



  // Merge the campaign filters with the tag and task filters.
  const mergedFilterBody = {
    ...campaignFilters,
    filter: combineFilters([
      campaignFilters.filter,
      createTagFilter(filterTagIDs),
      taskFilter,
    ]),
  };

  // TODO: this event name and filter body should be pulled from the microsite
  // config file
  target.getPage = api.getVerificationCallback(
    mergedFilterBody,
    filterTagIDs,
    // TODO: This tag map is to replace scientific names with common names. This is 
    //      temporary until tag groups are implmented on the server
    globalThis.siteParams?.tag_id_map,
  );
  target.urlTransformer = api.createMediaUrlTransformer();

  target.addEventListener("decision-made", (event) => {
    const decisions = event.detail;
    for (const [subject, receipt] of decisions) {
      const change = receipt.change;
      const verificationChange = change.verification;

      // If the verification change is null, it indicates that the user has
      // deleted a previously applied verification.
      if (verificationChange === null) {
        api.deleteVerification(subject);
      } else {
        // Each call to "upsertVerification" is an async fire and forget
        // call to the api.
        // Each request is an un-awaited async method call so that it
        // doesn't lock up the main thread and freeze the website when an
        // api call is made.
        //
        // If an upsert request errors or fails to be applied, there is no
        // retry logic, and the verification will fail to commit to the
        // database.
        api.upsertVerification(subject);
      }
    }
  });
}

/**
 * @description
 * Dismisses the verification grid's tutorial ("bootstrap") dialog if it was
 * opened inside the component's shadow root.
 *
 * @param {Element} gridElement
 */
function dismissBootstrapDialog(gridElement) {
  const bootstrap = gridElement.shadowRoot?.querySelector("oe-verification-bootstrap");
  if (bootstrap) {
    const closeBtn = bootstrap.shadowRoot?.querySelector(
      '[data-testid="dismiss-bootstrap-dialog-btn"]',
    );
    if (closeBtn) {
      closeBtn.click();
    } else {
      bootstrap.shadowRoot?.querySelector("dialog")?.close();
    }
  }
}

/**
 * @description
 * Shows the unconfirmed account warning banner and disables the verification
 * grid. The warning includes a contact link if a workbench host is configured.
 */
function showUnconfirmedAccountWarning() {
  const warning = document.getElementById("unconfirmed-account-warning");
  if (!warning) {
    return;
  }

  const workbenchHost = globalThis.siteParams?.workbench_host;
  const workbenchName = globalThis.siteParams?.workbench_name;
  if (workbenchHost) {
    const contactLinkContainer = document.getElementById(
      "unconfirmed-contact-link",
    );
    if (contactLinkContainer) {
      const contactLink = document.createElement("a");
      contactLink.href = `${workbenchHost}/contact_us`;
      contactLink.textContent = workbenchName
        ? `${workbenchName} contact form`
        : "contact us";

      const prefix = document.createTextNode(" If you need help, please use the ");
      const suffix = document.createTextNode(".");
      contactLinkContainer.append(prefix, contactLink, suffix);
    }
  }

  warning.classList.add("visible");
  warning.open = true;
}

async function setup() {
  const campaigns = globalThis.siteParams?.campaigns || [];
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
  let currentUserID = null;
  if (targetElements.length > 0) {
    if (!(await api.isLoggedIn())) {
      window.location.href = `/login?redirect=${location.pathname}`;
      return;
    }

    const userProfile = await api.getUserProfile();
    currentUserID = userProfile?.data?.id ?? null;
    if (userProfile?.data?.is_confirmed === false) {
      for (const element of targetElements) {
        // the dialog hides our not yet confirmed account warning, so we dismiss it first.
        dismissBootstrapDialog(element);
        element.style.display = "none";
        element.remove();
      }
      showUnconfirmedAccountWarning();
      return;
    }
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

    // Initialize the verification grid with the filter settings
    bootstrapVerificationGrid(element, campaign, currentUserID);
    element.classList.add("is-ready");
  }
}

setup();
