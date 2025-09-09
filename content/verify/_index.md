+++
title = "Can you hear a Plains Wanderer?"
+++

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

<div class="examples-container">
    <h3>Example Calls</h3>
    <div class="example-calls">
        {{< event-card audioRecordingId="352803" audioEventId="269965" label="Plains Wanderer (female)" >}}
        {{< /event-card >}}
        {{< event-card audioRecordingId="352803" audioEventId="269937" label="Plains Wanderer (male)" >}}
        {{< /event-card >}}
    </div>
</div>

<style>
.examples-container {
    margin-block: var(--micro-padding-large);
}

.example-calls {
    display: flex;
    gap: var(--micro-padding-medium);
    flex-wrap: wrap;

    > * {
        flex: 1 1;
        min-width: 20rem;
    }
}
</style>
