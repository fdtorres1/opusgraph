// app/admin/import/page.tsx
import { CSVImport } from "./csv-import";

export default function ImportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">CSV Import</h1>
        <p className="text-zinc-600 mt-2">
          Import composers or works from a CSV file. The system will validate data and detect duplicates.
        </p>
      </div>
      <CSVImport />
    </div>
  );
}

