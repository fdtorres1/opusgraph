"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Search, Loader2, User, Music } from "lucide-react";

type ComposerResult = {
  id: string;
  first_name: string;
  last_name: string;
};

type WorkResult = {
  id: string;
  work_name: string;
  composer_id: string;
};

export function PublicSearch() {
  const [query, setQuery] = useState("");
  const [composers, setComposers] = useState<ComposerResult[]>([]);
  const [works, setWorks] = useState<WorkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (query.length < 2) {
      setComposers([]);
      setWorks([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/search?q=${encodeURIComponent(query)}&type=${activeTab}`);
        if (res.ok) {
          const data = await res.json();
          setComposers(data.composers || []);
          setWorks(data.works || []);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
        <Input
          type="text"
          placeholder="Search for composers or works..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 text-lg h-12"
        />
      </div>

      {query.length >= 2 && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({composers.length + works.length})</TabsTrigger>
            <TabsTrigger value="composers">Composers ({composers.length})</TabsTrigger>
            <TabsTrigger value="works">Works ({works.length})</TabsTrigger>
          </TabsList>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          )}

          {!loading && (
            <>
              <TabsContent value="all" className="space-y-4">
                {composers.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Composers ({composers.length})
                    </h2>
                    <div className="grid gap-3">
                      {composers.map((composer) => (
                        <Card key={composer.id}>
                          <CardContent className="p-4">
                            <Link
                              href={`/composers/${composer.id}`}
                              className="hover:underline font-medium"
                            >
                              {composer.first_name} {composer.last_name}
                            </Link>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {works.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Music className="h-5 w-5" />
                      Works ({works.length})
                    </h2>
                    <div className="grid gap-3">
                      {works.map((work) => (
                        <Card key={work.id}>
                          <CardContent className="p-4">
                            <Link
                              href={`/works/${work.id}`}
                              className="hover:underline font-medium"
                            >
                              {work.work_name || "Untitled Work"}
                            </Link>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {!loading && composers.length === 0 && works.length === 0 && query.length >= 2 && (
                  <div className="text-center py-12 text-zinc-500">
                    <p>No results found for &quot;{query}&quot;</p>
                    <p className="text-sm mt-2">Try a different search term</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="composers" className="space-y-4">
                {composers.length > 0 ? (
                  <div className="grid gap-3">
                    {composers.map((composer) => (
                      <Card key={composer.id}>
                        <CardContent className="p-4">
                          <Link
                            href={`/composers/${composer.id}`}
                            className="hover:underline font-medium"
                          >
                            {composer.first_name} {composer.last_name}
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <p>No composers found for &quot;{query}&quot;</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="works" className="space-y-4">
                {works.length > 0 ? (
                  <div className="grid gap-3">
                    {works.map((work) => (
                      <Card key={work.id}>
                        <CardContent className="p-4">
                          <Link
                            href={`/works/${work.id}`}
                            className="hover:underline font-medium"
                          >
                            {work.work_name || "Untitled Work"}
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <p>No works found for &quot;{query}&quot;</p>
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      )}

      {query.length < 2 && (
        <div className="text-center py-12 text-zinc-500">
          <p>Start typing to search for composers and works</p>
          <p className="text-sm mt-2">Results show names only. Sign in to view full details.</p>
        </div>
      )}
    </div>
  );
}

