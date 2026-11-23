import { Plugin, ui } from "notia";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function isoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// A date counts when it stands alone in the path. `2030-01-150` does not
// contain `2030-01-15`, and the note body is not searched.
function pathHasDay(path, day) {
  let from = 0;
  while (from < path.length) {
    const at = path.indexOf(day, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : path[at - 1];
    const after = path[at + day.length] ?? "";
    const boundary = (char) => char === "" || char < "0" || char > "9";
    if (boundary(before) && boundary(after)) return true;
    from = at + 1;
  }
  return false;
}

function notesOn(app, day) {
  return app.vault
    .getNotes()
    .filter((note) => pathHasDay(note.path, day))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// The first line of body text, so a listed note shows a preview instead of
// repeating its path. Headings are skipped because the note name already
// carries the title.
function previewOf(app, note) {
  if (!app.vault.exists(note.path)) return note.path;
  for (const raw of app.vault.read(note.path).split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    return line.length > 120 ? `${line.slice(0, 119)}\u2026` : line;
  }
  return note.path;
}

function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

export default class Calendar extends Plugin {
  onload() {
    const today = new Date();
    this.year = today.getFullYear();
    this.month = today.getMonth();
    this.selected = isoDate(today);
    this.today = this.selected;
    this.panel = this.addPanel({
      id: "month",
      title: "Calendar",
      icon: "calendar",
      side: "right",
      render: () => this.renderPanel(),
    });
    this.app.vault.on("change", () => this.panel.refresh());
  }

  shift(by) {
    const next = new Date(this.year, this.month + by, 1);
    this.year = next.getFullYear();
    this.month = next.getMonth();
    this.panel.refresh();
  }

  select(date) {
    this.selected = isoDate(date);
    this.year = date.getFullYear();
    this.month = date.getMonth();
    this.panel.refresh();
  }

  // One quiet cell per date: no outline unless it is today, and the filled
  // accent is reserved for the selected date. Out-of-month days keep the same
  // chrome but paint their label muted, and a day with notes carries a dot.
  // `muted` and `dot` are optional fields a host without them ignores, so an
  // older Notia keeps the plain label instead of an unsupported element.
  dayButton(date, daysWithNotes) {
    const key = isoDate(date);
    let variant = "ghost";
    if (key === this.selected) variant = "primary";
    else if (key === this.today) variant = "outline";
    const options = { variant, tooltip: key };
    if (date.getMonth() !== this.month || date.getFullYear() !== this.year) {
      options.muted = true;
    }
    if (daysWithNotes.has(key)) {
      options.dot = variant === "primary" ? "primaryForeground" : true;
    }
    // The cell is centred in an equal track, so the numeral carries no padding.
    return ui.button(String(date.getDate()), () => this.select(date), options);
  }

  // The 42 visible days that at least one note falls on, so a render scans the
  // vault once instead of once per cell.
  daysWithNotes(cells) {
    const notes = this.app.vault.getNotes();
    const days = new Set();
    for (const date of cells) {
      const key = isoDate(date);
      if (notes.some((note) => pathHasDay(note.path, key))) days.add(key);
    }
    return days;
  }

  dayHeading() {
    const [year, month, day] = this.selected.split("-").map(Number);
    const weekday = WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()];
    return `${weekday} \u00b7 ${this.selected}`;
  }

  createNote() {
    const path = `${this.selected}.md`;
    if (!this.app.vault.exists(path)) this.app.vault.create(path, "");
    this.app.workspace.openNote(path);
  }

  // The day block is one group: hairline, heading with its count, then the
  // notes or the empty state. `minHeight` and `gap` are optional fields the
  // host keeps when it knows them and ignores otherwise.
  dayDetails(notes) {
    const count = notes.length
      ? ui.text(`${notes.length} ${notes.length === 1 ? "note" : "notes"}`, {
          muted: true,
          small: true,
        })
      : null;
    return ui.column(
      [
        ui.separator(),
        ui.row([ui.text(this.dayHeading(), { bold: true }), count], {
          wrap: false,
          spread: true,
        }),
        notes.length
          ? ui.list(
              notes.map((note) => ({
                title: note.name,
                subtitle: previewOf(this.app, note),
                onClick: () => this.app.workspace.openNote(note.path),
              })),
            )
          : ui.column([
              ui.text("No notes on this day", { muted: true }),
              ui.button("Create a note", () => this.createNote(), { variant: "primary" }),
            ]),
      ],
      { gap: 8, minHeight: 96 },
    );
  }

  renderPanel() {
    const cells = monthCells(this.year, this.month);
    const daysWithNotes = this.daysWithNotes(cells);
    const rows = [];
    for (let week = 0; week < 6; week++) {
      rows.push(
        ui.row(
          cells
            .slice(week * 7, week * 7 + 7)
            .map((date) => this.dayButton(date, daysWithNotes)),
          // One equal track per weekday, so every date shares the centre axis of
          // its column and each row keeps the same 36px pitch. `spread` stays on
          // the node: a host from before these fields ignores them and draws the
          // old full-width flex row, which is still the right fallback.
          { wrap: false, spread: true, columns: 7, gap: 0, rowHeight: 36 },
        ),
      );
    }
    const notes = notesOn(this.app, this.selected);
    const month = ui.column(
      [
        this.monthRow(),
        ui.row(
          WEEKDAYS.map((label) => ui.text(label, { muted: true, small: true })),
          // Same seven tracks and gap as the week rows, so a label sits over
          // the column it names.
          { wrap: false, spread: true, columns: 7, gap: 0 },
        ),
        ui.column(rows, { gap: 0 }),
      ],
      { gap: 8 },
    );
    // Two groups: the month, then the selected day. The week rows get no gap of
    // their own so the row pitch stays constant; the day block sits 4px under
    // the last row and the separator is its first child.
    return ui.column([month, this.dayDetails(notes)], { gap: 4 });
  }

  monthRow() {
    return ui.row(
      [
        ui.button("", () => this.shift(-1), {
          icon: "chevron-left",
          variant: "ghost",
          tooltip: "Previous month",
        }),
        ui.text(`${MONTHS[this.month]} ${this.year}`, { bold: true }),
        ui.button("", () => this.shift(1), {
          icon: "chevron-right",
          variant: "ghost",
          tooltip: "Next month",
        }),
      ],
      { wrap: false, spread: true },
    );
  }
}
