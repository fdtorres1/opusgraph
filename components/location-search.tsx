"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, MapPin } from "lucide-react";

type PlaceResult = {
  id: string;
  description: string;
  city?: string;
  admin_area?: string;
  country_iso2?: string;
  lat?: number;
  lon?: number;
  provider?: string;
};

type Props = {
  value: string | undefined;
  onSelect: (id: string | undefined) => void;
  placeholder?: string;
};

export function LocationSearch({ value, onSelect, placeholder = "Search for a location..." }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch selected place when value changes
  useEffect(() => {
    if (value) {
      fetch(`/api/places/${value}`)
        .then(res => res.json())
        .then(data => {
          if (data.id) {
            setSelectedPlace(data);
            setQuery(data.description);
          }
        })
        .catch(() => {
          // Place not found, clear selection
          setSelectedPlace(null);
          setQuery("");
        });
    } else {
      setSelectedPlace(null);
      setQuery("");
    }
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (selectedPlace && query === selectedPlace.description) {
      return; // Don't search if showing selected place
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Error searching places:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedPlace]);

  const handleSelect = (place: PlaceResult) => {
    setSelectedPlace(place);
    setQuery(place.description);
    setIsOpen(false);
    onSelect(place.id);
  };

  const handleClear = () => {
    setSelectedPlace(null);
    setQuery("");
    setIsOpen(false);
    onSelect(undefined);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedPlace) {
              setSelectedPlace(null);
              onSelect(undefined);
            }
          }}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          className="pr-10"
        />
        {selectedPlace && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {results.map((place) => (
            <button
              key={place.id}
              type="button"
              className="w-full text-left px-4 py-2 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none"
              onClick={() => handleSelect(place)}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-zinc-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{place.description}</div>
                  {place.city && (
                    <div className="text-xs text-zinc-500">
                      {place.city}
                      {place.admin_area && `, ${place.admin_area}`}
                      {place.country_iso2 && `, ${place.country_iso2}`}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg p-4 text-center text-sm text-zinc-500">
          Searching...
        </div>
      )}
    </div>
  );
}

