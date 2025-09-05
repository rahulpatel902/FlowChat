import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/use-toast';
import { X, Edit, Save, Mail, LogOut, Pencil } from 'lucide-react';
import { uploadProfilePicture, FILE_TYPES, validateFile } from '../../firebase/storage';
import { subscribeToPresence } from '../../firebase/rtdbPresence';

const ProfilePanel = ({ isDark = false, onClose }) => {
  const { user, updateProfile, logout } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selfOnline, setSelfOnline] = useState(null);
  const initialForm = useMemo(() => ({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    bio: user?.bio || '',
  }), [user?.first_name, user?.last_name, user?.bio]);

  const [formData, setFormData] = useState(initialForm);

  // Keep form in sync if user changes while panel open
  useEffect(() => {
    setFormData(initialForm);
  }, [initialForm]);

  // Keep presence in sync using RTDB (avoids stale AuthContext user.is_online)
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToPresence([user.id], (statuses) => {
      const st = statuses?.[String(user.id)];
      setSelfOnline(!!st?.isOnline);
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [user?.id]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { isValid, errors } = validateFile(file, 5, FILE_TYPES.IMAGES);
    if (!isValid) {
      toast({ title: 'Invalid image', description: errors.join(', '), variant: 'destructive' });
      return;
    }
    try {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    } catch (_) {}
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setIsLoading(true);
    let payload = { ...formData };
    // Only send changed text fields
    const base = initialForm;
    Object.keys(payload).forEach((k) => {
      if ((payload[k] || '') === (base[k] || '')) {
        delete payload[k];
      }
    });

    try {
      // If avatar selected, upload first
      if (avatarFile) {
        setUploadProgress(0);
        const uploaded = await uploadProfilePicture(avatarFile, user.id, (p) => setUploadProgress(p));
        payload.profile_picture = uploaded.url;
      }
      const result = await updateProfile(payload);
      if (result.success) {
        setIsEditing(false);
        setAvatarFile(null);
        if (avatarPreview) {
          try { URL.revokeObjectURL(avatarPreview); } catch (_) {}
          setAvatarPreview(null);
        }
        toast({ title: 'Profile updated', description: 'Your profile has been updated successfully.' });
      } else {
        toast({ title: 'Update failed', description: result.error, variant: 'destructive' });
      }
    } catch (e) {
      const msg = e?.message || 'Profile update failed';
      toast({ title: 'Update failed', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleCancel = () => {
    setFormData(initialForm);
    setIsEditing(false);
    if (avatarPreview) {
      try { URL.revokeObjectURL(avatarPreview); } catch (_) {}
    }
    setAvatarPreview(null);
    setAvatarFile(null);
  };

  const isDirty = useMemo(() => {
    const a = initialForm;
    const b = formData;
    return (
      (a.first_name || '') !== (b.first_name || '') ||
      (a.last_name || '') !== (b.last_name || '') ||
      (a.bio || '') !== (b.bio || '') ||
      !!avatarFile
    );
  }, [initialForm, formData, avatarFile]);

  const handleLogout = async () => {
    await logout();
    toast({ title: 'Logged out', description: 'You have been logged out successfully.' });
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]" aria-modal="true" role="dialog" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Centered Card */}
      <div className="absolute inset-0 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <div
          className={`w-full max-w-md max-h-[75vh] rounded-lg shadow-xl overflow-hidden ${isDark ? 'bg-[#13151a] text-gray-100' : 'bg-white'}`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
            <h2 className="text-lg font-semibold">Profile</h2>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <Button variant={isDark ? 'ghost' : 'outline'} size="sm" onClick={() => setIsEditing(true)} className={isDark ? 'hover:bg-violet-600 hover:text-white' : ''}>
                  <Edit className="h-4 w-4 mr-2" /> Edit
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={handleSave} disabled={!isDirty || isLoading}>
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                  <Button size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className={isDark ? 'hover:bg-violet-600 hover:text-white' : ''}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(75vh-56px)] custom-scrollbar">
          {/* Avatar and name */}
          <div className="flex items-center gap-4">
            <div className="relative">
              { (avatarPreview || user?.profile_picture) ? (
                <img
                  src={avatarPreview || user.profile_picture}
                  alt="Avatar"
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary text-white flex items-center justify-center text-lg font-semibold">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
              ) }
              {isEditing && (
                <>
                  <input id="avatar-input" type="file" accept="image/*" className="hidden" onChange={handlePickAvatar} />
                  <button
                    type="button"
                    aria-label="Edit photo"
                    className={`absolute -bottom-1 -right-1 h-7 w-7 flex items-center justify-center rounded-full border ${isDark ? 'bg-[#151821] text-gray-100 border-white/10 hover:bg-white/10' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-100'}`}
                    onClick={() => document.getElementById('avatar-input')?.click()}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold">{user?.full_name}</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>@{user?.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`h-2 w-2 rounded-full ${selfOnline ? 'bg-violet-600' : 'bg-gray-400'}`} />
                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{selfOnline ? 'Online' : 'Offline'}</span>
              </div>
              {isEditing && avatarFile && (
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Image selected. {uploadProgress > 0 ? `Uploading… ${uploadProgress.toFixed(0)}%` : 'Will upload on Save.'}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Mail className="h-4 w-4 inline mr-2" /> Email
            </label>
            <Input value={user?.email || ''} disabled className={isDark ? 'bg-[#151821] text-gray-100 border-transparent' : 'bg-gray-50'} />
          </div>

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>First Name</label>
              <Input name="first_name" value={formData.first_name} onChange={handleChange} disabled={!isEditing} className={isDark ? 'bg-[#151821] text-gray-100 border-transparent' : (!isEditing ? 'bg-gray-50' : '')} />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Last Name</label>
              <Input name="last_name" value={formData.last_name} onChange={handleChange} disabled={!isEditing} className={isDark ? 'bg-[#151821] text-gray-100 border-transparent' : (!isEditing ? 'bg-gray-50' : '')} />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Bio</label>
            <textarea
              name="bio"
              rows={3}
              value={formData.bio}
              onChange={handleChange}
              disabled={!isEditing}
              className={`w-full px-3 py-2 rounded-md border resize-none ${isDark ? 'bg-[#151821] text-gray-100 border-transparent placeholder:text-gray-400' : 'border-gray-300'} focus:outline-none`}
              placeholder="Tell us about yourself..."
            />
          </div>

          <div className={`pt-4 ${isDark ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProfilePanel;
