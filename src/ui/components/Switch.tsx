interface SwitchProps {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export const Switch = (props: SwitchProps) => (
  <button
    type="button"
    role="switch"
    class="switch"
    aria-checked={props.checked}
    aria-label={props.label}
    title={props.label}
    disabled={props.disabled}
    onClick={() => props.onChange(!props.checked)}
  >
    <span class="switch-thumb" />
  </button>
);
