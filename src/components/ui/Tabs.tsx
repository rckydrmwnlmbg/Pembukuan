'use client';

import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className = '', ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={`inline-flex h-9 items-center justify-start border-b border-[var(--line)] bg-transparent p-0 text-[var(--ink-muted)] ${className}`.trim()}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className = '', ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={`inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-3.5 py-1.5 text-xs font-medium transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-[var(--accent)] data-[state=active]:text-[var(--accent)] data-[state=active]:font-semibold ${className}`.trim()}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className = '', ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={`mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${className}`.trim()}
      {...props}
    />
  );
});
