# OpusGraph User Guide

This guide covers both the **Works Database** (for platform administrators) and the **Library Management** system (for ensemble organizations and individual users).

---

## Getting Started

### Signing Up

1. Go to [opusgraph.vercel.app](https://opusgraph.vercel.app) and click **Sign Up**
2. Enter your email and password
3. After signup, a personal library ("My Library") is automatically created for you
4. You'll be redirected to your library dashboard

### Logging In

After login, you'll be directed to:
- **Your library** (`/library/[your-org]/`) if you're a regular user
- **Admin dashboard** (`/admin`) if you're a platform administrator

---

## Library Management

### Dashboard

Your library dashboard (`/library/[orgSlug]/`) shows:
- **Stats**: Total entries in your catalog, entries by condition, total performances logged
- **Quick Actions**: Add Entry, Search Catalog, Log Performance
- **Recent Entries**: The 5 most recently added catalog entries
- **Recent Performances**: The 5 most recently logged performances

### Catalog

#### Browsing Your Catalog

Navigate to **Catalog** in the sidebar to see all entries in your library.

- **Search**: Type in the search box to find entries by title, composer, arranger, publisher, or notes
- **Filter by condition**: Use the dropdown to show only entries in a specific condition (Excellent, Good, Fair, Poor, Missing)
- **Sort**: Sort by title (A-Z), composer (A-Z), or date added (newest/oldest)
- **Load More**: Click to load additional entries beyond the first 50

#### Adding a New Entry

1. Click **Add New Entry** or navigate to **Catalog > Add New** in the sidebar
2. The entry editor opens with two approaches:

**Option A — Link to the Works Database:**
- Use the **Works Database Link** search at the top
- Type a work title (e.g., "Beethoven Symphony") to search published reference works
- Select a match to auto-populate metadata as placeholders (title, composer, publisher, instrumentation, duration)
- Override any field by typing your own value

**Option B — Standalone entry:**
- Skip the Works Database link and fill in all fields manually

3. Fill in the metadata:
   - **Title**: The work's title
   - **Composer**: First and last name (separate fields for sorting)
   - **Arranger**: If applicable
   - **Publisher**: Publisher name
   - **Instrumentation**: Description of parts required
   - **Duration**: In MM:SS format
   - **Year Composed**: Four-digit year

4. Fill in library-specific fields:
   - **Copies Owned**: How many copies/sets your org owns
   - **Location**: Physical location (e.g., "Shelf A, Cabinet 3, Room 201")
   - **Condition**: Overall condition (Excellent, Good, Fair, Poor, Missing)
   - **Notes**: Any additional notes

5. Changes **autosave** every 800ms — you'll see "Saving...", "Saved", or "Error" in the status bar

#### Managing Parts

In the entry editor, scroll to the **Parts** section:
- Click **+ Add Part** to add a part
- Each part has: Part Name (e.g., "Flute 1", "Soprano"), Quantity, Condition, Notes
- Click the **X** button to remove a part
- If any part has condition "Missing", a **Missing Parts** badge appears on the catalog card

#### Tagging Entries

In the entry editor, scroll to the **Tags** section (appears after the entry is saved):
- Search for existing tags or type to filter
- Click a tag to assign it
- Click the **X** on a tag badge to remove it
- Tags save immediately (not part of the autosave cycle)

#### Commenting on Entries

Below the entry editor, the **Comments** section shows:
- All comments from org members (all roles can comment)
- **Add Comment**: Type in the textarea and click "Add Comment"
- **Reply**: Click "Reply" on any comment to thread a response
- **Edit/Delete**: Only your own comments show edit and delete buttons

#### Deleting an Entry

- Click the **Delete** button (trash icon) in the entry editor
- Confirm in the dialog — this permanently deletes the entry, its parts, tags, and comments

### Performances

#### Viewing Performances

Navigate to **Performances** in the sidebar to see all logged performances ordered by date (newest first). Each card shows the date, event name, venue, season, and how many works were on the program.

#### Logging a New Performance

1. Click **Log New Performance**
2. Fill in:
   - **Date**: When the performance occurred
   - **Event Name**: e.g., "Spring Concert 2026", "Sunday Service"
   - **Venue**: Where it took place
   - **Season**: e.g., "2025-2026"
   - **Notes**: Any additional notes
3. Build the program:
   - Use the search input to find entries from your catalog
   - Click to add them to the program
   - Use **Up/Down** buttons to reorder
   - Add per-work notes (e.g., "Encore", "Intermission follows")
   - Click **X** to remove a work from the program
4. Changes autosave automatically

### CSV Import

Navigate to **Import** in the sidebar to bulk-import entries from a spreadsheet.

**Step 1 — Upload**: Select a CSV file from your computer

**Step 2 — Map Columns**: Map your spreadsheet columns to library fields:
- Title (required)
- Composer First Name, Composer Last Name
- Arranger, Publisher, Instrumentation
- Copies Owned, Location, Condition, Notes

**Step 3 — Validate**: Review validation results. Rows with errors (red) must be fixed in your CSV. Warnings (yellow) flag potential duplicates.

**Step 4 — Execute**: Click to import. Choose whether to skip rows that match existing entries.

**Step 5 — Results**: See how many rows succeeded, failed, or were skipped. Click links to view created entries.

### Tags

Navigate to **Tags** in the sidebar (managers and owners only) to manage your org's taxonomy.

- **Create Tag**: Click "Create Tag", enter a name, optional category (Season, Genre, Difficulty), and pick a color
- **Edit Tag**: Click the pencil icon to modify name, category, or color
- **Delete Tag**: Click the trash icon and confirm — this removes the tag from all entries

Common tag categories:
- **Season**: Advent, Christmas, Lent, Easter, Ordinary Time
- **Genre**: Classical, Romantic, Contemporary, Sacred, Folk
- **Difficulty**: Grade 1-5, Easy, Medium, Hard

### Activity Feed

Navigate to **Activity** in the sidebar to see a chronological log of everything that's happened in your library:
- Catalog entries created, updated, or deleted
- Performances logged
- Members invited, roles changed
- Comments posted

Use the filters to narrow by source type (Revision, Comment) or entity type (Library Entry, Performance, etc.).

---

## Organization Management

### Roles

Each organization has three roles:

| Role | Catalog | Performances | Tags | Comments | Members | Settings |
|------|---------|-------------|------|----------|---------|----------|
| **Owner** | Full CRUD | Full CRUD | Full CRUD | Read/Write | Invite, Change Roles, Remove | Full access |
| **Manager** | Full CRUD | Full CRUD | Full CRUD | Read/Write | Invite | View only |
| **Member** | Read only | Read only | Read only | Read/Write | View only | No access |

### Organization Settings

Owners can access **Settings** in the sidebar to:
- Edit the organization name and type (Orchestra, Choir, Band, Church, School, Other)
- View the current subscription plan
- Delete the organization (permanently removes all data)

### Managing Members

Owners can access **Settings > Members** to:
- **View** all org members with their roles
- **Invite** new members by email (they must have an OpusGraph account)
- **Change roles** via the dropdown (Owner, Manager, Member)
- **Remove** members (cannot remove the last owner)

### Personal Libraries

Individual users automatically get a "My Library" organization. This works exactly like an ensemble org but:
- Settings nav item is hidden (no members to manage)
- You can convert it to an ensemble org by going to settings, changing the name and type, and inviting members

---

## Works Database (Platform Admins)

Platform administrators manage the global Works Database at `/admin`. This is a curated reference catalog of composers and musical works that powers the auto-populate feature in the library.

### Admin Roles

| Role | Permissions |
|------|------------|
| **Super Admin** | Full platform control |
| **Admin** | Manage reference data, delete entities |
| **Contributor** | Create and edit reference data |

### Managing Composers

- **List**: `/admin/composers` shows all composers
- **Create**: Click "New Composer" to add a composer with name, birth/death years, nationality, gender, links
- **Edit**: Click any composer to edit. Changes autosave.
- **Publish**: Toggle between Draft and Published status
- **Delete**: Admin/Super Admin only

### Managing Works

- **List**: `/admin/works` shows all works
- **Create**: Click "New Work" to add a work with title, composer, instrumentation, duration, publisher, sources, recordings
- **Edit**: Click any work to edit. Changes autosave.
- **Publish**: Toggle between Draft and Published. Published works appear in the library's reference search.
- **Delete**: Admin/Super Admin only

### Review Queue

`/admin/review` shows flagged items:
- Possible duplicates detected by similarity algorithms
- Items flagged for review
- Side-by-side comparison and merge functionality

### CSV Import (Reference Data)

`/admin/import` for bulk-importing composers or works into the reference database.

### Activity Feed

`/admin/activity` shows all reference database changes — revisions, comments, and review flags.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + B` | Toggle sidebar collapse |

---

## FAQ

**Q: Can I use OpusGraph without an ensemble?**
A: Yes. Every user gets a personal "My Library" automatically. You can catalog your own sheet music collection.

**Q: What happens if I link an entry to a reference work and then override fields?**
A: Your overrides take precedence. The reference data shows as placeholder text in the form. If you clear your override, the reference value is used for display.

**Q: Can members add entries to the catalog?**
A: No. Members have read-only access to the catalog and performances. Only managers and owners can create, edit, or delete entries. However, members CAN comment on entries.

**Q: How does the CSV import handle duplicates?**
A: During validation, the system checks for entries with similar titles already in your library. You can choose to skip duplicate rows or import them anyway.

**Q: Can I belong to multiple organizations?**
A: Yes. You can be a member of multiple orgs with different roles in each. Use the library URL to navigate between them.
