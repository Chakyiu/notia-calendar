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

  dayButton(date) {
    const key = isoDate(date);
    const inMonth = date.getMonth() === this.month && date.getFullYear() === this.year;
    let variant = inMonth || key === this.today ? "outline" : "ghost";
    if (key === this.selected) variant = "primary";
    return ui.button(String(date.getDate()).padStart(2, " "), () => this.select(date), {
      variant,
      tooltip: key,
    });
  }

  renderPanel() {
    const cells = monthCells(this.year, this.month);
    const rows = [];
    for (let week = 0; week < 6; week++) {
      rows.push(
        ui.row(
          cells.slice(week * 7, week * 7 + 7).map((date) => this.dayButton(date)),
          { wrap: false },
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
      ui.heading(this.selected),
      notes.length
        ? ui.list(
            notes.map((note) => ({
              title: note.name,
              subtitle: note.path,
              onClick: () => this.app.workspace.openNote(note.path),
            })),
          )
        : ui.empty("No notes on this day"),
    ];
  }
}
