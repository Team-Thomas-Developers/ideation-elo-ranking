import { useEffect, useState } from 'react'
import {
  createIdea,
  deleteIdea,
  getMyIdeas,
  updateIdea,
} from '../../lib/ideaApi'

const emptyForm = {
  title: '',
  description: '',
}

export function IdeaManager({ session }) {
  const token = session?.access_token
  const [ideas, setIdeas] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(Boolean(token))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return undefined

    let ignore = false

    async function loadIdeas() {
      setIsLoading(true)
      setError('')

      try {
        const rows = await getMyIdeas(token)
        if (!ignore) setIdeas(rows ?? [])
      } catch (loadError) {
        if (!ignore) setError(loadError.message || 'Unable to load ideas.')
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    loadIdeas()

    return () => {
      ignore = true
    }
  }, [token])

  if (!session) return null

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId('')
    setIsFormOpen(false)
  }

  function startEdit(idea) {
    setForm({
      title: idea.title ?? '',
      description: idea.description ?? '',
    })
    setEditingId(idea.id)
    setIsFormOpen(true)
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const title = form.title.trim()
    const description = form.description.trim()

    if (!title) {
      setError('Idea name is required.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      if (editingId) {
        const updatedIdea = await updateIdea(token, editingId, {
          title,
          description,
        })
        setIdeas((current) =>
          current.map((idea) => (idea.id === updatedIdea.id ? updatedIdea : idea)),
        )
      } else {
        const newIdea = await createIdea(token, { title, description })
        setIdeas((current) => [newIdea, ...current])
      }

      resetForm()
    } catch (saveError) {
      setError(saveError.message || 'Unable to save idea.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id) {
    setError('')

    try {
      await deleteIdea(token, id)
      setIdeas((current) => current.filter((idea) => idea.id !== id))
      if (editingId === id) resetForm()
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete idea.')
    }
  }

  return (
    <section className="panel ideas-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Your Ideas</span>
          <h2>Submit an idea</h2>
        </div>
        <button
          className="vote-button"
          type="button"
          onClick={() => {
            setIsFormOpen((current) => !current)
            setEditingId('')
            setForm(emptyForm)
            setError('')
          }}
        >
          Add New Idea
        </button>
      </div>

      {isFormOpen ? (
        <form className="idea-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              value={form.title}
              onChange={(event) => updateForm('title', event.target.value)}
              placeholder="Idea name"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              placeholder="Describe the idea"
              rows="3"
            />
          </label>
          <div className="idea-actions">
            <button className="vote-button" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Submit Idea'}
            </button>
            <button
              className="vote-button secondary-button"
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="vote-error">{error}</p> : null}

      {isLoading ? (
        <p className="empty-matchups">Loading ideas...</p>
      ) : ideas.length > 0 ? (
        <div className="idea-list">
          {ideas.map((idea) => (
            <article className="idea-card" key={idea.id}>
              <div>
                <h3>{idea.title}</h3>
                {idea.description ? <p>{idea.description}</p> : null}
              </div>
              <div className="idea-actions">
                <button
                  className="vote-button"
                  type="button"
                  onClick={() => startEdit(idea)}
                >
                  Edit
                </button>
                <button
                  className="vote-button secondary-button"
                  type="button"
                  onClick={() => handleDelete(idea.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-matchups">No ideas submitted yet.</p>
      )}
    </section>
  )
}
