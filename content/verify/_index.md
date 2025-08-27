+++
title = "Can you hear a Plains Wanderer?"
+++

<script
    type="module"
    src="https://cdn.jsdelivr.net/npm/@ecoacoustics/web-components/dist/components.js"
></script>

<oe-verification-grid data-campaign="Powerful Owl" id="verification-grid" grid-size="1">
    <oe-verification verified="true" shortcut="y">Yes</oe-verification>
    <oe-verification verified="false" shortcut="n">No</oe-verification>
    <oe-verification verified="unsure" shortcut="u">Unsure</oe-verification>
    <oe-data-source
        slot="data-source"
        for="verification-grid"
        allow-downloads="false"
    ></oe-data-source>
</oe-verification-grid>
