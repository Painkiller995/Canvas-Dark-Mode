import { createUniqueId, For } from 'solid-js';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** Native radios, so arrow-key navigation comes from the browser. */
export const Segmented = <T extends string>(props: SegmentedProps<T>) => {
  const name = createUniqueId();
  return (
    <fieldset class="segmented">
      <legend class="visually-hidden">{props.label}</legend>
      <For each={props.options}>
        {(option) => (
          <label class="segmented-option">
            <input
              type="radio"
              class="visually-hidden"
              name={name}
              value={option.value}
              checked={props.value === option.value}
              onChange={() => props.onChange(option.value)}
            />
            {option.label}
          </label>
        )}
      </For>
    </fieldset>
  );
};
