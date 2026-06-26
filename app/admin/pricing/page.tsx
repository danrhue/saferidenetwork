'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

export default function AdminPricing() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('pricing_settings')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching pricing settings:', error);
      // Try to create default if missing? But rely on schema insert
    }
    if (data) {
      setSettings(data);
    } else {
      console.warn('No pricing_settings row found - using local defaults for editing (save will attempt insert).');
      setSettings({
        id: null,
        base_rate_per_mile: 2.5,
        platform_fee_percent: 0.15,
        peak_rules: [
          { startHour: 6.5, endHour: 9, days: [1,2,3,4,5], multiplier: 1.35 },
          { startHour: 13.5, endHour: 16, days: [1,2,3,4,5], multiplier: 1.35 }
        ],
        updated_at: new Date().toISOString(),
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage('');

    // If no id (new), insert; else update the existing row
    let error;
    if (!settings.id) {
      const { error: insertError } = await supabase
        .from('pricing_settings')
        .insert({
          base_rate_per_mile: parseFloat(settings.base_rate_per_mile),
          platform_fee_percent: parseFloat(settings.platform_fee_percent),
          peak_rules: settings.peak_rules,
          updated_at: new Date().toISOString(),
        });
      error = insertError;
    } else {
      const { error: updateError } = await supabase
        .from('pricing_settings')
        .update({
          base_rate_per_mile: parseFloat(settings.base_rate_per_mile),
          platform_fee_percent: parseFloat(settings.platform_fee_percent),
          peak_rules: settings.peak_rules,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);
      error = updateError;
    }

    if (error) {
      setMessage('Error saving: ' + error.message);
    } else {
      setMessage('Settings saved successfully!');
      await fetchSettings();
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-blue-800">Loading pricing settings...</div>;
  }

  return (
    <div className="max-w-4xl">
        <AdminPageHeader
          title="Pricing Settings"
          subtitle="Control the base rate per mile and platform fees used across the platform."
        />

        {!settings ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-blue-800">
            No pricing settings found. A default row should be created automatically.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-blue-950 mb-1">Base Rate Per Mile (USD)</label>
              <input
                type="number"
                step="0.01"
                value={settings.base_rate_per_mile}
                onChange={(e) => setSettings({ ...settings, base_rate_per_mile: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
              />
              <p className="text-xs text-blue-700 mt-1">This is the main rate paid to drivers per mile driven (before peak adjustments).</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-950 mb-1">Platform Fee Percentage</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={settings.platform_fee_percent}
                  onChange={(e) => setSettings({ ...settings, platform_fee_percent: e.target.value })}
                  className="w-32 border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                />
                <span className="text-sm text-blue-800">(e.g. 0.15 = 15%)</span>
              </div>
              <p className="text-xs text-blue-700 mt-1">Charged on top of driver compensation (paid by organizations at trip completion).</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-950 mb-1">Peak Time Rules (JSON)</label>
              <textarea
                value={JSON.stringify(settings.peak_rules || [], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setSettings({ ...settings, peak_rules: parsed });
                  } catch {}
                }}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 font-mono text-sm h-40 text-blue-950 placeholder:text-blue-700"
              />
              <p className="text-xs text-blue-700 mt-1">
                Optional: Array of peak rules. Each: {"{startHour, endHour, days: number[], multiplier}"}
              </p>
            </div>

            {message && (
              <p className={message.includes('Error') ? 'text-sm text-red-600' : 'text-sm text-green-600'}>
                {message}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1E3A8A] hover:bg-blue-900 text-white px-6 py-3 rounded-xl font-medium disabled:opacity-70"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <p className="text-xs text-blue-700">
              Changes will take effect immediately for new trip price calculations on the organization side.
            </p>
          </div>
        )}
    </div>
  );
}