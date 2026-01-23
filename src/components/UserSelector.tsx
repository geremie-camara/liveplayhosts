"use client";

import { useState, useEffect, useMemo } from "react";
import { UserRole } from "@/lib/types";
import { ROLE_NAMES, ROLE_COLORS, ACTIVE_ROLES } from "@/lib/roles";
import { Location } from "@/lib/location-types";
import { UserSelection } from "@/lib/broadcast-types";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  location?: string;
}

interface UserSelectorProps {
  value: UserSelection;
  onChange: (selection: UserSelection) => void;
}

// Group locations by region
const US_COUNTRY = "United States";

export default function UserSelector({ value, onChange }: UserSelectorProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [searchSelected, setSearchSelected] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, locationsRes] = await Promise.all([
        fetch("/api/hosts?excludeRoles=applicant,rejected"),
        fetch("/api/locations"),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
      if (locationsRes.ok) {
        const locationsData = await locationsRes.json();
        setLocations(locationsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Group locations by US vs International
  const { usLocations, internationalLocations } = useMemo(() => {
    const us: Location[] = [];
    const intl: Location[] = [];
    locations.forEach((loc) => {
      if (loc.country === US_COUNTRY) {
        us.push(loc);
      } else {
        intl.push(loc);
      }
    });
    return { usLocations: us, internationalLocations: intl };
  }, [locations]);

  // Filter available users based on selected roles and locations
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Must not already be selected
      if (value.selectedUserIds.includes(user.id)) return false;

      // Filter by roles (if any selected)
      if (value.filterRoles.length > 0 && !value.filterRoles.includes(user.role)) {
        return false;
      }

      // Filter by locations (if any selected)
      if (value.filterLocations.length > 0) {
        if (!user.location || !value.filterLocations.includes(user.location)) {
          return false;
        }
      }

      // Filter by search
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = user.email.toLowerCase();
        if (!fullName.includes(search) && !email.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [users, value, searchFilter]);

  // Get selected users
  const selectedUsers = useMemo(() => {
    const selected = users.filter((user) => value.selectedUserIds.includes(user.id));

    // Filter by search in selected
    if (searchSelected) {
      const search = searchSelected.toLowerCase();
      return selected.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = user.email.toLowerCase();
        return fullName.includes(search) || email.includes(search);
      });
    }

    return selected;
  }, [users, value.selectedUserIds, searchSelected]);

  // Handlers
  const toggleRole = (role: UserRole) => {
    const newRoles = value.filterRoles.includes(role)
      ? value.filterRoles.filter((r) => r !== role)
      : [...value.filterRoles, role];
    onChange({ ...value, filterRoles: newRoles });
  };

  const toggleLocation = (locationName: string) => {
    const newLocations = value.filterLocations.includes(locationName)
      ? value.filterLocations.filter((l) => l !== locationName)
      : [...value.filterLocations, locationName];
    onChange({ ...value, filterLocations: newLocations });
  };

  const addUser = (userId: string) => {
    if (!value.selectedUserIds.includes(userId)) {
      onChange({ ...value, selectedUserIds: [...value.selectedUserIds, userId] });
    }
  };

  const removeUser = (userId: string) => {
    onChange({
      ...value,
      selectedUserIds: value.selectedUserIds.filter((id) => id !== userId),
    });
  };

  const addAllFiltered = () => {
    const newIds = filteredUsers.map((u) => u.id);
    const combined = Array.from(new Set([...value.selectedUserIds, ...newIds]));
    onChange({ ...value, selectedUserIds: combined });
  };

  const removeAll = () => {
    onChange({ ...value, selectedUserIds: [] });
  };

  const selectAllRoles = () => {
    onChange({ ...value, filterRoles: [...ACTIVE_ROLES] as UserRole[] });
  };

  const clearRoles = () => {
    onChange({ ...value, filterRoles: [] });
  };

  const selectAllLocations = () => {
    onChange({ ...value, filterLocations: locations.map((l) => l.name) });
  };

  const clearLocations = () => {
    onChange({ ...value, filterLocations: [] });
  };

  // Toggle all US locations
  const toggleUSLocations = () => {
    const usLocationNames = usLocations.map((l) => l.name);
    const allUSSelected = usLocationNames.every((name) => value.filterLocations.includes(name));

    if (allUSSelected) {
      // Remove all US locations
      const newLocations = value.filterLocations.filter((l) => !usLocationNames.includes(l));
      onChange({ ...value, filterLocations: newLocations });
    } else {
      // Add all US locations
      const combined = Array.from(new Set([...value.filterLocations, ...usLocationNames]));
      onChange({ ...value, filterLocations: combined });
    }
  };

  // Toggle all International locations
  const toggleInternationalLocations = () => {
    const intlLocationNames = internationalLocations.map((l) => l.name);
    const allIntlSelected = intlLocationNames.every((name) => value.filterLocations.includes(name));

    if (allIntlSelected) {
      // Remove all international locations
      const newLocations = value.filterLocations.filter((l) => !intlLocationNames.includes(l));
      onChange({ ...value, filterLocations: newLocations });
    } else {
      // Add all international locations
      const combined = Array.from(new Set([...value.filterLocations, ...intlLocationNames]));
      onChange({ ...value, filterLocations: combined });
    }
  };

  // Check if all locations in a region are selected
  const allUSSelected = usLocations.length > 0 && usLocations.every((l) => value.filterLocations.includes(l.name));
  const allIntlSelected = internationalLocations.length > 0 && internationalLocations.every((l) => value.filterLocations.includes(l.name));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 min-h-[400px]">
      {/* Left Column: Filters */}
      <div className="border rounded-lg bg-gray-50 p-4 overflow-y-auto">
        <h3 className="font-semibold text-dark mb-3">Filters</h3>

        {/* Role Filter */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Roles</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={selectAllRoles}
                className="text-xs text-accent hover:underline"
              >
                All
              </button>
              <span className="text-xs text-gray-400">|</span>
              <button
                type="button"
                onClick={clearRoles}
                className="text-xs text-gray-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {ACTIVE_ROLES.map((role) => (
              <label
                key={role}
                className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={value.filterRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="rounded border-gray-300 text-accent focus:ring-accent"
                />
                <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>
                  {ROLE_NAMES[role]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Locations</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={selectAllLocations}
                className="text-xs text-accent hover:underline"
              >
                All
              </button>
              <span className="text-xs text-gray-400">|</span>
              <button
                type="button"
                onClick={clearLocations}
                className="text-xs text-gray-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* US Locations */}
          {usLocations.length > 0 && (
            <div className="mb-3">
              <button
                type="button"
                onClick={toggleUSLocations}
                className={`text-xs font-medium mb-1 flex items-center gap-1 hover:text-accent transition-colors w-full text-left p-1 rounded ${
                  allUSSelected ? "text-accent bg-accent/10" : "text-gray-500"
                }`}
              >
                <span>🇺🇸</span> United States
                {allUSSelected && (
                  <svg className="w-3 h-3 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <div className="space-y-1 ml-2">
                {usLocations.map((loc) => (
                  <label
                    key={loc.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={value.filterLocations.includes(loc.name)}
                      onChange={() => toggleLocation(loc.name)}
                      className="rounded border-gray-300 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-gray-700">{loc.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* International Locations */}
          {internationalLocations.length > 0 && (
            <div>
              <button
                type="button"
                onClick={toggleInternationalLocations}
                className={`text-xs font-medium mb-1 flex items-center gap-1 hover:text-accent transition-colors w-full text-left p-1 rounded ${
                  allIntlSelected ? "text-accent bg-accent/10" : "text-gray-500"
                }`}
              >
                <span>🌍</span> International
                {allIntlSelected && (
                  <svg className="w-3 h-3 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <div className="space-y-1 ml-2">
                {internationalLocations.map((loc) => (
                  <label
                    key={loc.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={value.filterLocations.includes(loc.name)}
                      onChange={() => toggleLocation(loc.name)}
                      className="rounded border-gray-300 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-gray-700">
                      {loc.name}
                      <span className="text-gray-400 text-xs ml-1">({loc.country})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle Column: Available Users */}
      <div className="border rounded-lg bg-white p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-dark">
            Available ({filteredUsers.length})
          </h3>
          <button
            type="button"
            onClick={addAllFiltered}
            disabled={filteredUsers.length === 0}
            className="text-xs px-2 py-1 bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add All
          </button>
        </div>

        <input
          type="text"
          placeholder="Search available..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border rounded mb-3 focus:ring-accent focus:border-accent"
        />

        <div className="flex-1 overflow-y-auto space-y-1">
          {filteredUsers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              {value.filterRoles.length === 0 && value.filterLocations.length === 0
                ? "Select roles or locations to filter users"
                : "No users match the current filters"}
            </p>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${ROLE_COLORS[user.role]}`}>
                      {ROLE_NAMES[user.role]}
                    </span>
                    {user.location && (
                      <span className="text-gray-400">{user.location}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addUser(user.id)}
                  className="ml-2 p-1 text-accent hover:bg-accent hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Add user"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Selected Users */}
      <div className="border rounded-lg bg-white p-4 flex flex-col border-accent">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-dark">
            Selected ({value.selectedUserIds.length})
          </h3>
          <button
            type="button"
            onClick={removeAll}
            disabled={value.selectedUserIds.length === 0}
            className="text-xs px-2 py-1 text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Remove All
          </button>
        </div>

        <input
          type="text"
          placeholder="Search selected..."
          value={searchSelected}
          onChange={(e) => setSearchSelected(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border rounded mb-3 focus:ring-accent focus:border-accent"
        />

        <div className="flex-1 overflow-y-auto space-y-1">
          {selectedUsers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No users selected yet.
              <br />
              <span className="text-xs">Use filters and add users from the middle column.</span>
            </p>
          ) : (
            selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${ROLE_COLORS[user.role]}`}>
                      {ROLE_NAMES[user.role]}
                    </span>
                    {user.location && (
                      <span className="text-gray-400">{user.location}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeUser(user.id)}
                  className="ml-2 p-1 text-red-500 hover:bg-red-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove user"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {value.selectedUserIds.length > 0 && (
          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Total recipients:</span>
              <span className="font-medium text-gray-900">{value.selectedUserIds.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
