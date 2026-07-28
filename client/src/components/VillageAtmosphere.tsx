export type VillageAtmosphereMode = "DAY" | "TRANSITION" | "NIGHT";

export function VillageAtmosphere({ mode }: { mode: VillageAtmosphereMode }) {
  return (
    <div className={`village-atmosphere village-atmosphere--${mode.toLowerCase()}`} aria-hidden="true">
      <div className="village-sky village-sky-day" />
      <div className="village-sky village-sky-night" />
      <div className="village-sun" />
      <div className="village-moon">
        <span className="village-moon-crater village-moon-crater-one" />
        <span className="village-moon-crater village-moon-crater-two" />
      </div>
      <div className="village-cloud village-cloud-one" />
      <div className="village-cloud village-cloud-two" />

      <div className="village-houses">
        <svg viewBox="0 0 1440 390" preserveAspectRatio="none">
          <path className="village-ground-back" d="M0 287C173 253 298 281 451 263C612 244 758 290 918 258C1085 225 1248 273 1440 245V390H0Z" />
          <g className="village-buildings">
            <path d="M48 300V224H176V300M31 228L111 169L195 228Z" />
            <path d="M225 300V243H322V300M210 246L274 196L338 246Z" />
            <path d="M380 300V203H526V300M359 208L454 137L549 208Z" />
            <path d="M608 300V231H724V300M590 235L666 178L742 235Z" />
            <path d="M804 300V218H929V300M784 222L866 160L949 222Z" />
            <path d="M1013 300V238H1115V300M997 241L1064 190L1132 241Z" />
            <path d="M1190 300V211H1336V300M1168 216L1263 144L1358 216Z" />
          </g>
          <g className="village-windows">
            <path d="M89 245H119V276H89ZM421 231H454V267H421ZM649 250H678V280H649ZM846 243H877V276H846ZM1245 239H1278V275H1245Z" />
          </g>
          <path className="village-ground-front" d="M0 315C239 278 410 326 625 300C836 274 1054 320 1440 283V390H0Z" />
        </svg>
      </div>

      <div className="village-day-trees">
        <DayTree className="village-day-tree-one" />
        <DayTree className="village-day-tree-two" />
        <DayTree className="village-day-tree-three" />
      </div>

      <div className="village-night-trees">
        <NightTree className="village-night-tree-one" />
        <NightTree className="village-night-tree-two" />
        <NightTree className="village-night-tree-three" />
      </div>

      <div className="village-night-fog village-night-fog-one" />
      <div className="village-night-fog village-night-fog-two" />
      <div className="village-readable-shade" />
    </div>
  );
}

function DayTree({ className }: { className: string }) {
  return (
    <span className={`village-day-tree ${className}`}>
      <span className="village-day-tree-trunk" />
      <span className="village-day-tree-crown village-day-tree-crown-one" />
      <span className="village-day-tree-crown village-day-tree-crown-two" />
      <span className="village-day-tree-crown village-day-tree-crown-three" />
    </span>
  );
}

function NightTree({ className }: { className: string }) {
  return (
    <svg className={`village-night-tree ${className}`} viewBox="0 0 220 330">
      <path d="M111 330C108 275 110 233 105 190C101 159 94 127 89 92" />
      <path d="M105 218C77 193 58 169 42 137L18 117M45 141L40 99L25 75M68 166L77 124L68 91" />
      <path d="M104 190C132 166 151 139 168 105L199 84M166 109L176 66L193 39M139 151L135 104L146 73" />
      <path d="M93 127L75 92L78 48M91 102L105 66L102 29M114 167L125 124L118 89" />
    </svg>
  );
}
