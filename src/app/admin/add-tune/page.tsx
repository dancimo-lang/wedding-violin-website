'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminButton } from '@/components/admin/AdminButton';
import { ArrowLeft, Plus, Upload } from 'lucide-react';
import {
  practiceTipsError,
  validateScoreFile,
  validateSheetMusicFile,
} from '@/lib/tune-files';
import type { Tune } from '@/lib/tune-types';

const emptyForm = {
  title: '',
  type: '',
  key: '',
  composer: '',
  difficulty: 'Beginner',
  description: '',
  youtubeId: '',
  tags: '',
  practiceTips: '',
};

export default function AddTunePage() {
  const [formData, setFormData] = useState(emptyForm);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [scoreFile, setScoreFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [tunes, setTunes] = useState<Tune[]>([]);
  const [editId, setEditId] = useState('');
  const [editTips, setEditTips] = useState('');
  const [editScore, setEditScore] = useState<File | null>(null);
  const [editFileKey, setEditFileKey] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tunes')
      .then((response) => response.json())
      .then((data: { tunes?: Tune[] }) => {
        if (!cancelled) setTunes(Array.isArray(data.tunes) ? data.tunes : []);
      })
      .catch(() => {
        if (!cancelled) setEditMessage({ type: 'error', text: 'The tune list could not be loaded.' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });
    if (!pdfFile) {
      setMessage({ type: 'error', text: 'Sheet music must be a PDF.' });
      return;
    }
    const pdfError = validateSheetMusicFile(pdfFile);
    if (pdfError) {
      setMessage({ type: 'error', text: pdfError });
      return;
    }
    if (scoreFile) {
      const scoreError = validateScoreFile(scoreFile);
      if (scoreError) {
        setMessage({ type: 'error', text: scoreError });
        return;
      }
    }
    const tipsError = practiceTipsError(formData.practiceTips.trim());
    if (tipsError) {
      setMessage({ type: 'error', text: tipsError });
      return;
    }

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('type', formData.type);
      formDataToSend.append('key', formData.key);
      formDataToSend.append('composer', formData.composer);
      formDataToSend.append('difficulty', formData.difficulty);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('youtubeId', formData.youtubeId);
      formDataToSend.append('tags', formData.tags);
      formDataToSend.append('practiceTips', formData.practiceTips);
      formDataToSend.append('pdf', pdfFile);
      if (scoreFile) formDataToSend.append('score', scoreFile);

      const response = await fetch('/api/admin/tunes', {
        method: 'POST',
        body: formDataToSend,
      });
      const responseData = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Tune added successfully!' });
        setFormData(emptyForm);
        setPdfFile(null);
        setScoreFile(null);
        setFileKey((value) => value + 1);
      } else {
        setMessage({ type: 'error', text: responseData.message || responseData.error || 'Failed to add tune' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `An error occurred: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    setEditMessage({ type: '', text: '' });
    if (!editId) {
      setEditMessage({ type: 'error', text: 'Choose a tune to edit.' });
      return;
    }
    const tipsError = practiceTipsError(editTips.trim());
    if (tipsError) {
      setEditMessage({ type: 'error', text: tipsError });
      return;
    }
    if (editScore) {
      const scoreError = validateScoreFile(editScore);
      if (scoreError) {
        setEditMessage({ type: 'error', text: scoreError });
        return;
      }
    }

    setEditSaving(true);
    try {
      const body = new FormData();
      body.append('practiceTips', editTips);
      if (editScore) body.append('score', editScore);
      const response = await fetch(`/api/admin/tunes/${editId}`, { method: 'PATCH', body });
      const responseData = await response.json();
      if (!response.ok) {
        setEditMessage({ type: 'error', text: responseData.message || responseData.error || 'Failed to update tune' });
        return;
      }
      setTunes((current) =>
        current.map((tune) =>
          tune.id === editId ? { ...tune, practiceTips: editTips.trim(), museScorePath: responseData.tune?.museScorePath || tune.museScorePath } : tune,
        ),
      );
      setEditScore(null);
      setEditFileKey((value) => value + 1);
      setEditMessage({ type: 'success', text: 'Tune updated.' });
    } catch (error) {
      setEditMessage({ type: 'error', text: `An error occurred: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl space-y-8">
          <div>
            <Link href="/services/lessons/resources" className="inline-flex items-center gap-2 font-medium text-amber-600 hover:text-amber-700">
              <ArrowLeft className="h-5 w-5" aria-hidden />
              Back to Tune Library
            </Link>
          </div>

          <div className="rounded-xl bg-white p-8 shadow-lg">
            <h1 className="mb-2 flex items-center gap-3 text-2xl font-bold text-gray-900">
              <Plus className="h-6 w-6 text-amber-600" aria-hidden />
              Add New Tune
            </h1>
            <p className="mb-6 text-sm text-gray-600">Saving updates the live tune library.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-700">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="type" className="mb-2 block text-sm font-medium text-gray-700">
                    Type *
                  </label>
                  <input
                    type="text"
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    placeholder="e.g., Waltz, Jig, Scale"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="key" className="mb-2 block text-sm font-medium text-gray-700">
                    Key *
                  </label>
                  <input
                    type="text"
                    id="key"
                    name="key"
                    value={formData.key}
                    onChange={handleInputChange}
                    placeholder="e.g., G Major, D Minor"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="composer" className="mb-2 block text-sm font-medium text-gray-700">
                    Composer *
                  </label>
                  <input
                    type="text"
                    id="composer"
                    name="composer"
                    value={formData.composer}
                    onChange={handleInputChange}
                    placeholder="e.g., Traditional, Jay Ungar"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="difficulty" className="mb-2 block text-sm font-medium text-gray-700">
                    Difficulty *
                  </label>
                  <select
                    id="difficulty"
                    name="difficulty"
                    value={formData.difficulty}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-700">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="practiceTips" className="mb-2 block text-sm font-medium text-gray-700">
                  Practice tips
                </label>
                <textarea
                  id="practiceTips"
                  name="practiceTips"
                  value={formData.practiceTips}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Shown on the tune page only when filled."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="youtubeId" className="mb-2 block text-sm font-medium text-gray-700">
                  YouTube Video ID
                </label>
                <input
                  type="text"
                  id="youtubeId"
                  name="youtubeId"
                  value={formData.youtubeId}
                  onChange={handleInputChange}
                  placeholder="e.g., E6SrQadACCc"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="tags" className="mb-2 block text-sm font-medium text-gray-700">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  placeholder="e.g., irish, jig, traditional"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="pdf" className="mb-2 block text-sm font-medium text-gray-700">
                  Sheet Music PDF *
                </label>
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-amber-500">
                  <input
                    key={`pdf-${fileKey}`}
                    type="file"
                    id="pdf"
                    accept=".pdf,application/pdf"
                    onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                    className="hidden"
                    required
                  />
                  <label htmlFor="pdf" className="cursor-pointer">
                    <Upload className="mx-auto mb-2 h-12 w-12 text-gray-400" aria-hidden />
                    <p className="text-gray-600">{pdfFile ? pdfFile.name : 'Click to upload PDF'}</p>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="score" className="mb-2 block text-sm font-medium text-gray-700">
                  MuseScore file (.mscz, .mxl, or .musicxml)
                </label>
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-amber-500">
                  <input
                    key={`score-${fileKey}`}
                    type="file"
                    id="score"
                    accept=".mscz,.mxl,.musicxml"
                    onChange={(event) => setScoreFile(event.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <label htmlFor="score" className="cursor-pointer">
                    <Upload className="mx-auto mb-2 h-12 w-12 text-gray-400" aria-hidden />
                    <p className="text-gray-600">{scoreFile ? scoreFile.name : 'Optional. Click to upload a MuseScore file'}</p>
                  </label>
                </div>
              </div>

              {message.text ? (
                <div role="status" className={`rounded-lg p-4 ${message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                  {message.text}
                </div>
              ) : null}

              <AdminButton type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Adding Tune...' : 'Add Tune'}
              </AdminButton>
            </form>
          </div>

          <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Edit a tune</h2>
            <p className="mb-6 text-sm text-gray-600">
              Update practice tips or replace the MuseScore file. Saving updates the live tune library.
            </p>
            <form onSubmit={handleEdit} className="space-y-6">
              <div>
                <label htmlFor="edit-tune" className="mb-2 block text-sm font-medium text-gray-700">
                  Tune
                </label>
                <select
                  id="edit-tune"
                  value={editId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const selected = tunes.find((tune) => tune.id === nextId);
                    setEditId(nextId);
                    setEditTips(selected?.practiceTips ?? '');
                    setEditMessage({ type: '', text: '' });
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Choose a tune</option>
                  {tunes.map((tune) => (
                    <option key={tune.id} value={tune.id}>
                      {tune.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-tips" className="mb-2 block text-sm font-medium text-gray-700">
                  Practice tips
                </label>
                <textarea
                  id="edit-tips"
                  value={editTips}
                  onChange={(event) => setEditTips(event.target.value)}
                  rows={4}
                  placeholder="Shown on the tune page only when filled."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label htmlFor="edit-score" className="mb-2 block text-sm font-medium text-gray-700">
                  Replace MuseScore file
                </label>
                <input
                  key={`edit-score-${editFileKey}`}
                  id="edit-score"
                  type="file"
                  accept=".mscz,.mxl,.musicxml"
                  onChange={(event) => setEditScore(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-700"
                />
              </div>
              {editMessage.text ? (
                <div role="status" className={`rounded-lg p-4 ${editMessage.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                  {editMessage.text}
                </div>
              ) : null}
              <AdminButton type="submit" disabled={editSaving || !editId} className="w-full">
                {editSaving ? 'Saving...' : 'Save tune'}
              </AdminButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
