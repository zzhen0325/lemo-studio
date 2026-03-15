import * as React from "react";
import { cn } from "@/lib/utils";

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
}

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(({ collapsed, className, ...props }, ref) => {
  return (
    <aside
      ref={ref}
      className={cn(
        "flex flex-col h-full overflow-y-auto transition-all duration-300",
        "bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] ",
        collapsed ? "w-[10rem]" : "w-[14rem]",
        className
      )}
      {...props}
    />
  );
});
Sidebar.displayName = "Sidebar";

const SidebarHeader = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => (
  <header
    ref={ref}
    className={cn(
      "flex items-center gap-2 p-4 w-full",
      "bg-[hsl(var(--sidebar-background))] ",
      className
    )}
    {...props}
  />
 ));
SidebarHeader.displayName = "SidebarHeader";

const SidebarContent = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn("flex-grow space-y-2 p-2", className)}
    {...props}
  />
 ));
SidebarContent.displayName = "SidebarContent";

const SidebarFooter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn(
      "sticky bottom-0 p-2",
      "bg-[hsl(var(--sidebar-background))] ",
      className
    )}
    {...props}
  />
 ));
SidebarFooter.displayName = "SidebarFooter";

export { Sidebar, SidebarHeader, SidebarContent, SidebarFooter };
