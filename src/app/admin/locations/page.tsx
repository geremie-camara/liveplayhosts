"use client";

import { useState, useEffect } from "react";
import { Location, LocationFormData, COUNTRIES } from "@/lib/location-types";

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<LocationFormData>({
    name: "",
    country: "",
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/admin/locations");
      if (res.ok) {
        const data = await res.json();
        setLocations(data);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.country.trim()) {
      alert("Please fill in all fields");
      return;
    }

    setSaving(true);

    try {
      const url = editingId
        ? `/api/admin/locations/${editingId}`
        : "/api/admin/locations";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await fetchLocations();
        resetForm();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save location");
      }
    } catch (error) {
      console.error("Error saving location:", error);
      alert("Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (location: Location) => {
    setFormData({
      name: location.name,
      country: location.country,
    });
    setEditingId(location.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/locations/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchLocations();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete location");
      }
    } catch (error) {
      console.error("Error deleting location:", error);
      alert("Failed to delete location");
    }
  };

  const resetForm = () => {
    setFormData({ name: "", country: "" });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Locations</h1>
          <p className="text-gray-600 mt-2">
            Manage locations for tagging users.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Location
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-dark mb-4">
            {editingId ? "Edit Location" : "Add New Location"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                  placeholder="e.g., Los Angeles"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country *
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                >
                  <option value="">Select a country...</option>
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Add Location"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Locations Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-500 border-b">
              <th className="px-6 py-4 font-medium">Location</th>
              <th className="px-6 py-4 font-medium">Country</th>
              <th className="px-6 py-4 font-medium">Created</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No locations yet. Add your first location above.
                </td>
              </tr>
            ) : (
              locations.map((location) => (
                <tr key={location.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-medium text-dark">{location.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{location.country}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {new Date(location.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(location)}
                      className="text-accent hover:underline text-sm mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(location.id, location.name)}
                      className="text-red-500 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
