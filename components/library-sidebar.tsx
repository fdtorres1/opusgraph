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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  BookOpen,
  Music,
  Upload,
  Activity,
  Tags,
  Settings,
  User,
  LogOut,
  Shield,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type OrgProps = {
  org: { id: string; slug: string; name: string; type: string; plan_tier: string };
};

function buildMenuItems(orgSlug: string, orgType: string) {
  const base = `/library/${orgSlug}`;
  const isPersonal = orgType === "other";

  const items = [
    {
      title: "Dashboard",
      url: base,
      icon: LayoutDashboard,
    },
    {
      title: "Catalog",
      url: `${base}/catalog`,
      icon: BookOpen,
      children: [
        {
          title: "All Entries",
          url: `${base}/catalog`,
        },
        {
          title: "Add New",
          url: `${base}/catalog/new`,
        },
      ],
    },
    {
      title: "Performances",
      url: `${base}/performances`,
      icon: Music,
    },
    {
      title: "Import",
      url: `${base}/import`,
      icon: Upload,
    },
    {
      title: "Activity",
      url: `${base}/activity`,
      icon: Activity,
    },
    {
      title: "Tags",
      url: `${base}/tags`,
      icon: Tags,
    },
  ];

  // Personal orgs (single-member) don't need org-level settings (member management, etc.)
  if (!isPersonal) {
    items.push({
      title: "Settings",
      url: `${base}/settings`,
      icon: Settings,
    });
  }

  return items;
}

export function LibrarySidebar({ org }: OrgProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const menuItems = buildMenuItems(org.slug, org.type);
  const basePath = `/library/${org.slug}`;

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from("user_profile")
          .select("admin_role")
          .eq("user_id", user.id)
          .single();
        if (profile && ["super_admin", "admin", "contributor"].includes(profile.admin_role || "")) {
          setIsAdmin(true);
        }
      }
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
          <SidebarGroupLabel>{org.name}</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.url ||
                (item.url !== basePath && pathname?.startsWith(item.url));

              if (item.children) {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <Icon />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                    <div className="group-data-[collapsible=icon]:hidden">
                      {item.children.map((child) => {
                        const childActive = pathname === child.url;
                        return (
                          <SidebarMenuItem key={child.title}>
                            <SidebarMenuButton
                              asChild
                              isActive={childActive}
                              className="ml-6"
                            >
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
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <Icon />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
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
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Admin Dashboard">
                <Link href="/admin">
                  <Shield />
                  <span className="group-data-[collapsible=icon]:hidden">Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="User">
              <User />
              <span className="group-data-[collapsible=icon]:hidden">
                {user?.email || "Loading..."}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
              <LogOut />
              <span className="group-data-[collapsible=icon]:hidden">
                Logout
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
