# GitHub Setup Guide

## Creating the GitHub Repository

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Repository name: `opusgraph`
   - Description: "Classical music database application"
   - Choose Public or Private
   - **Do NOT** initialize with README, .gitignore, or license (we already have these)

2. **Push your local repository to GitHub:**

```bash
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/opusgraph.git

# Rename branch to main if needed
git branch -M main

# Push to GitHub
git push -u origin main
```

## Setting Up GitHub Projects

GitHub Projects is a great way to manage tasks, track progress, and plan your roadmap.

### Option 1: Using GitHub CLI (Recommended)

If you have GitHub CLI installed:

```bash
# Install GitHub CLI if you don't have it: brew install gh (macOS) or see https://cli.github.com/

# Authenticate
gh auth login

# Create a new project
gh project create --title "OpusGraph Development" --body "Project management for OpusGraph development"

# Or create a project from a template
gh project create --template "kanban"
```

### Option 2: Using GitHub Web Interface

1. **Create a new project:**
   - Go to your repository: https://github.com/YOUR_USERNAME/opusgraph
   - Click on the "Projects" tab
   - Click "New project"
   - Choose a template (Kanban, Board, or Table) or start from scratch
   - Name it "OpusGraph Development"

2. **Add initial columns:**
   - **Backlog**: Ideas and future features
   - **To Do**: Tasks ready to be worked on
   - **In Progress**: Currently being worked on
   - **Review**: Code review or testing
   - **Done**: Completed tasks

3. **Create initial issues:**
   - Click "Add item" → "Create issue"
   - Create issues for:
     - "Composer Editor Page" - Create admin interface for composer management
     - "CSV Import Functionality" - Implement CSV import with duplicate detection
     - "Public Search Interface" - Build public-facing search page
     - "Stripe Integration" - Set up subscription management
     - "Activity Panel UI" - Build admin activity feed interface
     - "Review Queue Management" - Create UI for managing review flags
     - "Location Search Integration" - Implement Google Places/Nominatim location search
     - "Full-Text Search" - Enhance search with PostgreSQL full-text search

4. **Create milestones:**
   - Go to Issues → Milestones → New milestone
   - Create milestones like:
     - "MVP v1.0" - Core functionality
     - "v1.1" - Enhanced features
     - "v1.2" - Public features

5. **Link issues to project:**
   - Drag issues from the sidebar into your project columns
   - Or use the "Projects" dropdown when creating/editing issues

## GitHub Project Templates

You can create issues directly from this template:

### Issue Template Example

**Title:** [Feature] Composer Editor Page

**Description:**
```
Create an admin interface for managing composer profiles, mirroring the work editor functionality.

**Acceptance Criteria:**
- [ ] Autosave functionality
- [ ] Draft/Published toggle
- [ ] Birth/death year and place management
- [ ] Nationality multi-select
- [ ] Composer links management
- [ ] Gender identity selection
- [ ] Activity tracking

**Related Files:**
- `app/admin/composers/[id]/page.tsx` (to be created)
- `app/admin/composers/[id]/composer-editor.tsx` (to be created)
```

## Project Roadmap

Use GitHub Projects to track:

1. **Current Sprint**: What's being worked on now
2. **Backlog**: Features and improvements to consider
3. **Bugs**: Issues that need fixing
4. **Documentation**: Docs that need updating
5. **Research**: Items that need investigation

## Tips

- Use labels to categorize issues (enhancement, bug, documentation, etc.)
- Assign issues to team members
- Link pull requests to issues using keywords like "Closes #123"
- Use project automation to move items between columns automatically
- Set due dates for milestones to track progress

