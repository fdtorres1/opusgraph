"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
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
  User,
  LogOut,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

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
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

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
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin/profile"} tooltip="Profile">
              <Link href="/admin/profile">
                <User />
                <span className="group-data-[collapsible=icon]:hidden">
                  {user?.email || "Profile"}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
              <LogOut />
              <span className="group-data-[collapsible=icon]:hidden">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

