// app/search/page.tsx
import { PublicSearch } from "./public-search";

export default function SearchPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Search OpusGraph</h1>
        <p className="text-zinc-600">
          Discover composers and their works. Sign in to view full details.
        </p>
      </div>
      <PublicSearch />
    </div>
  );
}

