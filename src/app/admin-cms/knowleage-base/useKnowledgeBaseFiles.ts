"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { FileItem } from "./types";

const isAllowedFile = (fileName: string) => {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".docx");
};

const getFileName = (file: FileItem) => {
  const value = (file.key || file.name || "").toString();
  const parts = value.split("/");
  return parts[parts.length - 1] || value;
};

export function useKnowledgeBaseFiles(userEmail?: string, enabled?: boolean) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [prevTokens, setPrevTokens] = useState<Array<string | null>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/api/botpress/files`, {
        withAuth: true,
        params: currentToken ? { nextToken: currentToken } : undefined,
      });

      const filesList: FileItem[] = (data?.files || []) as any;
      const tokenFromResp: string | null = (data?.meta?.nextToken || null) as any;

      setFiles(filesList);
      setNextToken(tokenFromResp);
    } catch (err: any) {
      setError(err.message || "Failed to fetch files");
    } finally {
      setLoading(false);
    }
  }, [currentToken, enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchFiles();
  }, [enabled, fetchFiles]);

  const handleNextPage = useCallback(() => {
    if (!nextToken) return;
    setPrevTokens((prev) => [...prev, currentToken]);
    setCurrentToken(nextToken);
  }, [currentToken, nextToken]);

  const handlePrevPage = useCallback(() => {
    setPrevTokens((prev) => {
      if (prev.length === 0) return prev;
      const newPrev = [...prev];
      const token = newPrev.pop();
      setCurrentToken(token ?? null);
      return newPrev;
    });
  }, []);

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const name = (file.key || file.name || "").toString();
      return isAllowedFile(name);
    });
  }, [files]);

  const searchByName = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearchActive(false);
      return;
    }

    setIsSearchActive(true);
    setSearching(true);
    setSearchError(null);

    try {
      let token: string | null = null;
      const allFiles: FileItem[] = [];

      while (true) {
        const data = await apiRequest(`/api/botpress/files`, {
          withAuth: true,
          params: token ? { nextToken: token } : undefined,
        });

        const pageFiles: FileItem[] = (data?.files || []) as any;
        allFiles.push(...pageFiles);

        const next = (data?.meta?.nextToken || null) as any;
        if (!next) break;
        token = next;
      }

      const filtered = allFiles
        .filter((file) => {
          const name = (file.key || file.name || "").toString();
          return isAllowedFile(name);
        })
        .filter((file) => {
          const name = (file.key || file.name || "").toString().toLowerCase();
          return name.includes(query);
        });

      setSearchResults(filtered);
    } catch (err: any) {
      setSearchError(err?.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setSearchResults([]);
    setSearchError(null);
    setIsSearchActive(false);
  }, []);

  return {
    files,
    filteredFiles,
    loading,
    error,
    nextToken,
    prevTokens,
    getFileName,
    fetchFiles,
    handleNextPage,
    handlePrevPage,
    searchTerm,
    setSearchTerm,
    searching,
    searchResults,
    searchError,
    searchByName,
    clearSearch,
    isSearchActive,
  };
}
