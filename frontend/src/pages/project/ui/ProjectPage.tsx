import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../shared/api';
import { Layout } from '../../../widgets/layout';

interface DocumentListItem {
	id: string;
	title: string;
	status: string;
	author: { name: string };
}

interface Project {
	id: string;
	workspaceId: string;
	name: string;
	description: string | null;
	documents: DocumentListItem[];
}

interface SearchResult {
	projectId: string;
	query: string;
	documents: DocumentListItem[];
	error: string | null;
}

export function ProjectPage() {
	const { id } = useParams();
	const [loadedProject, setProject] = useState<Project>();
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [query, setQuery] = useState('');
	const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
	const [searchVersion, setSearchVersion] = useState(0);
	const [loadError, setLoadError] = useState<{ projectId: string; message: string } | null>(null);
	const [createError, setCreateError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const project = loadedProject?.id === id ? loadedProject : undefined;
	const workspaceId = project?.workspaceId;
	const normalizedQuery = query.trim();
	const searching = normalizedQuery.length >= 2;
	const currentResult =
		searchResult && searchResult.projectId === id && searchResult.query === normalizedQuery
			? searchResult
			: null;
	const searchLoading = searching && currentResult === null;
	const searchError = searching ? currentResult?.error : null;
	const documents = searching ? (currentResult?.documents ?? []) : (project?.documents ?? []);
	const error = loadError && loadError.projectId === id ? loadError.message : null;

	const load = useCallback(
		(signal?: AbortSignal): Promise<Project> => api('/projects/' + id, { signal }),
		[id],
	);

	useEffect(() => {
		if (!id) return;
		const controller = new AbortController();
		void load(controller.signal)
			.then((result) => {
				if (!controller.signal.aborted) {
					setProject(result);
					setLoadError(null);
				}
			})
			.catch((error: Error) => {
				if (!controller.signal.aborted) {
					setLoadError({ projectId: id, message: error.message });
				}
			});
		return () => controller.abort();
	}, [load, id]);

	useEffect(() => {
		if (!id || !workspaceId || normalizedQuery.length < 2) return;
		const controller = new AbortController();
		const timer = window.setTimeout(async () => {
			const params = new URLSearchParams({ q: normalizedQuery, limit: '20', offset: '0' });
			try {
				const result: DocumentListItem[] = await api(
					`/workspaces/${encodeURIComponent(workspaceId)}/documents/search?${params}`,
					{ signal: controller.signal },
				);
				if (!controller.signal.aborted) {
					setSearchResult({
						projectId: id,
						query: normalizedQuery,
						documents: result,
						error: null,
					});
				}
			} catch (error) {
				if (!controller.signal.aborted) {
					setSearchResult({
						projectId: id,
						query: normalizedQuery,
						documents: [],
						error: (error as Error).message,
					});
				}
			}
		}, 300);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [id, workspaceId, normalizedQuery, searchVersion]);

	if (error) {
		return (
			<Layout>
				<p>!Ошибка: {error}</p>
			</Layout>
		);
	}

	if (!project) {
		return (
			<Layout>
				<p>Загрузка...</p>
			</Layout>
		);
	}

	return (
		<Layout>
			<Link to="/projects">← Проекты</Link>
			<h1>{project.name}</h1>
			<p>{project.description}</p>
			<label htmlFor="document-search">Поиск документов во всём workspace</label>
			<input
				id="document-search"
				type="search"
				placeholder="Введите минимум 2 символа"
				maxLength={100}
				value={query}
				onChange={(event) => {
					const value = event.target.value;
					if (value.trim() !== normalizedQuery) setSearchResult(null);
					setQuery(value);
				}}
			/>
			<h2>Документы ({documents.length})</h2>
			{searchLoading && <p role="status">Ищем документы...</p>}
			{searchError && (
				<p className="error" role="alert">
					Ошибка поиска: {searchError}
				</p>
			)}
			{!searchLoading && !searchError && documents.length === 0 && (
				<p>{searching ? 'Документы не найдены.' : 'В проекте пока нет документов.'}</p>
			)}
			{documents.map((doc) => (
				<Link className="doc" to={`/documents/${doc.id}`} key={doc.id}>
					<b>{doc.title}</b>
					<span>
						{doc.status} · {doc.author.name}
					</span>
				</Link>
			))}
			<section className="card">
				<h2>Новый документ</h2>
				{createError && (
					<p className="error" role="alert">
						{createError}
					</p>
				)}
				<input
					placeholder="Заголовок"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
				/>
				<textarea
					placeholder="Содержание"
					value={content}
					onChange={(event) => setContent(event.target.value)}
				/>
				<button
					disabled={creating}
					onClick={async () => {
						setCreating(true);
						setCreateError(null);
						try {
							await api(`/projects/${id}/documents`, {
								method: 'POST',
								body: JSON.stringify({ title, content }),
							});
							setTitle('');
							setContent('');
							setSearchResult(null);
							setSearchVersion((version) => version + 1);
							setProject(await load());
							setLoadError(null);
						} catch (error) {
							setCreateError((error as Error).message);
						} finally {
							setCreating(false);
						}
					}}
				>
					{creating ? 'Создаём...' : 'Создать'}
				</button>
			</section>
		</Layout>
	);
}
