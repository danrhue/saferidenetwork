'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

interface Update {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function AdminUpdates() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<Update | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      await fetchUpdates();
      setLoading(false);
    };
    load();
  }, []);

  const fetchUpdates = async () => {
    const { data, error } = await supabase
      .from('company_updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setUpdates(data || []);
  };

  // Open Create / Edit Modal
  const openModal = (update?: Update) => {
    if (update) {
      setEditingUpdate(update);
      setFormData({ title: update.title, content: update.content });
    } else {
      setEditingUpdate(null);
      setFormData({ title: '', content: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUpdate(null);
    setFormData({ title: '', content: '' });
  };

  // Create or Update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      alert("Title and content are required");
      return;
    }

    setSubmitting(true);

    try {
      if (editingUpdate) {
        const { error } = await supabase
          .from('company_updates')
          .update({
            title: formData.title,
            content: formData.content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingUpdate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_updates')
          .insert({
            title: formData.title,
            content: formData.content,
          });
        if (error) throw error;
      }

      closeModal();
      await fetchUpdates();
      alert(editingUpdate ? 'Update updated successfully!' : 'Update posted successfully!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (update: Update) => {
    setDeleteModal({ id: update.id, title: update.title });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;

    const { error } = await supabase
      .from('company_updates')
      .delete()
      .eq('id', deleteModal.id);

    if (error) {
      alert('Failed to delete update');
    } else {
      alert('Update deleted successfully');
      setDeleteModal(null);
      await fetchUpdates();
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
          <AdminPageHeader
            title="Company Updates"
            subtitle="Create and manage announcements for drivers"
          />
          <button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
          >
            + New Update
          </button>
        </div>

        {/* Updates Table */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-blue-100">
              <tr>
                <th className="text-left p-4 text-blue-950">Title</th>
                <th className="text-left p-4 text-blue-950">Posted</th>
                <th className="text-right p-4 text-blue-950">Actions</th>
              </tr>
            </thead>
            <tbody>
              {updates.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-blue-700">
                    No updates posted yet.
                  </td>
                </tr>
              )}
              {updates.map((update) => (
                <tr key={update.id} className="border-t">
                  <td className="p-4 font-medium">{update.title}</td>
                  <td className="p-4 text-sm text-blue-800">
                    {new Date(update.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openModal(update)}
                        className="px-4 py-1.5 text-sm border border-blue-200 rounded-lg hover:bg-blue-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteModal(update)}
                        className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-semibold text-blue-950">
                {editingUpdate ? 'Edit Update' : 'Create New Update'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-blue-950 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                  placeholder="Enter update title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-950 mb-1">Content (Markdown supported)</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={10}
                  className="w-full border rounded-xl px-4 py-3 font-mono text-sm text-blue-950 placeholder:text-blue-700"
                  placeholder="Write your update here... (Markdown supported)"
                  required
                />
                <p className="text-xs text-blue-700 mt-1">
                  Tip: Use **bold**, *italic*, and line breaks for formatting.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="px-6 py-2.5 border rounded-xl text-blue-950">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl disabled:opacity-70"
                >
                  {submitting ? 'Saving...' : editingUpdate ? 'Save Changes' : 'Post Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold text-blue-950 mb-2">Delete Update?</h3>
            <p className="text-blue-800 mb-6">
              Are you sure you want to delete <span className="font-medium">"{deleteModal.title}"</span>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModal(null)} className="px-5 py-2.5 border rounded-xl text-blue-950">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await supabase.from('company_updates').delete().eq('id', deleteModal.id);
                  setDeleteModal(null);
                  await fetchUpdates();
                }}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700"
              >
                Delete Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
