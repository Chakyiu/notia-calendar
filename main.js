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
  // accent is reserved for the selected date.
  dayButton(date) {
    const key = isoDate(date);
    let variant = "ghost";
    if (key === this.selected) variant = "primary";
    else if (key === this.today) variant = "outline";
    return ui.button(String(date.getDate()).padStart(2, " "), () => this.select(date), {
      variant,
      tooltip: key,
    });
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

  dayDetails(notes) {
    const count = notes.length
      ? ui.text(`${notes.length} ${notes.length === 1 ? "note" : "notes"}`, {
          muted: true,
          small: true,
        })
      : null;
    return ui.column([
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
    ]);
  }

  renderPanel() {
    const cells = monthCells(this.year, this.month);
    const rows = [];
    for (let week = 0; week < 6; week++) {
      rows.push(
        ui.row(
          cells.slice(week * 7, week * 7 + 7).map((date) => this.dayButton(date)),
          { wrap: false, spread: true },
        ),
      );
    }
    const notes = notesOn(this.app, this.selected);
    return [
      ui.row(
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
      ),
      ui.row(
        WEEKDAYS.map((label) => ui.text(label, { muted: true, small: true })),
        { wrap: false, spread: true },
      ),
      ...rows,
      ui.separator(),
      this.dayDetails(notes),
    ];
  }
}
