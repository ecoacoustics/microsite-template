// TODO: Refactor this function once we support object annotations
// see: https://github.com/ecoacoustics/web-components/issues/501
export function createAnnotation(
  annotationTarget,
  audioEvent,
  label,
  contextPaddingStart,
) {
  const eventDuration =
    audioEvent.end_time_seconds - audioEvent.start_time_seconds;

  // Because annotations do not obey the spectrogram offset, we have to set
  // the start-time relative to the start of the spectrogram.
  //
  // TODO: Once the oe-annotate component supports spectrogram offsets,
  // we can remove the contextPaddingStart parameter and just use the
  // audioEvent.start_time_seconds directly.
  // see: https://github.com/ecoacoustics/web-components/issues/505
  // When frequency bounds are null, the event spans the full frequency range.
  const lowFrequency = audioEvent.low_frequency_hertz ?? 0;
  const highFrequency = audioEvent.high_frequency_hertz ?? audioEvent.audio_recording.sample_rate_hertz / 2;

  const attributeMap = new Map([
    ["start-time", contextPaddingStart],
    ["end-time", eventDuration + contextPaddingStart],
    ["low-frequency", lowFrequency],
    ["high-frequency", highFrequency],
    ["tags", label],
  ]);

  const annotationElement = document.createElement("oe-annotation");
  for (const [key, value] of attributeMap) {
    annotationElement.setAttribute(key, value);
  }

  annotationTarget.appendChild(annotationElement);
}
