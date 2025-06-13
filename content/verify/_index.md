+++
title = 'Can you hear a Plains Wanderer?'
draft = false
+++

<script
    type="module"
    src="https://cdn.jsdelivr.net/npm/@ecoacoustics/web-components/dist/components.js"
></script>

<sl-input id="auth-token-input" type="password" label="Authentication Token" password-toggle></sl-input>

You can find your authentication token by navigating to
[staging.ecosounds.org/my_account](https://staging.ecosounds.org/my_account) and
clicking on the "Copy" icon on the bottom left of the page.

<oe-verification-grid data-campaign="Powerful Owl" id="verification-grid" grid-size="1">
    <oe-verification verified="true" shortcut="y">Yes</oe-verification>
    <oe-verification verified="false" shortcut="n">No</oe-verification>
    <oe-data-source
        slot="data-source"
        for="verification-grid"
        allow-downloads="false"
    ></oe-data-source>
</oe-verification-grid>
