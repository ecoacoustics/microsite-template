import { initializeProgressCounters } from "./progressCounter.js";
import { renderProgressCounter } from "./progressCounterDomRenderer.js";
import { renderProgressCounterGauge } from "./progressCounterGaugeRenderer.js";

initializeProgressCounters((root, state) => {
	renderProgressCounter(root, state, renderProgressCounterGauge);
});
