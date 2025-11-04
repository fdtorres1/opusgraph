"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Music,
  Activity,
  Flag,
  FileText,
  Upload,
} from "lucide-react";

const menuItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Composers",
    url: "/admin/composers",
    icon: Users,
    children: [
      {
        title: "All Composers",
        url: "/admin/composers",
      },
      {
        title: "New Composer",
        url: "/admin/composers/new",
      },
    ],
  },
  {
    title: "Works",
    url: "/admin/works",
    icon: Music,
    children: [
      {
        title: "All Works",
        url: "/admin/works",
      },
      {
        title: "New Work",
        url: "/admin/works/new",
      },
    ],
  },
  {
    title: "Activity",
    url: "/admin/activity",
    icon: Activity,
  },
  {
    title: "Review Queue",
    url: "/admin/review",
    icon: Flag,
  },
  {
    title: "CSV Import",
    url: "/admin/import",
    icon: Upload,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.url || (item.url !== "/admin" && pathname?.startsWith(item.url));
              
              if (item.children) {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.url}>
                        <Icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <div className="group-data-[collapsible=icon]:hidden">
                      {item.children.map((child) => {
                        const childActive = pathname === child.url;
                        return (
                          <SidebarMenuItem key={child.title}>
                            <SidebarMenuButton asChild isActive={childActive} className="ml-6">
                              <Link href={child.url}>
                                <span>{child.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </div>
                  </SidebarMenuItem>
                );
              }

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                    <Link href={item.url}>
                      <Icon />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

