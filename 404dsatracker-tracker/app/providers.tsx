'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import React from 'react'
import { ThemeCustomizerProvider } from './theme-customizer-context'

// Create a client for the entire app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeCustomizerProvider>
        {children}
        <Toaster />
      </ThemeCustomizerProvider>
    </QueryClientProvider>
  )
}
