import {useEffect, useState} from 'react';
import {InstallDeb, ListInstalledApplications, SelectDebFile, UninstallPackage} from '../wailsjs/go/main/App';
import type {main} from '../wailsjs/go/models';

type Tab = 'install' | 'uninstall';

function App() {
    const [tab, setTab] = useState<Tab>('install');
    const [selectedPath, setSelectedPath] = useState('');
    const [status, setStatus] = useState<main.InstallResult | null>(null);
    const [isChoosing, setIsChoosing] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isResultOpen, setIsResultOpen] = useState(false);
    const [applications, setApplications] = useState<main.InstalledApplication[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<main.InstalledApplication | null>(null);
    const [isLoadingApplications, setIsLoadingApplications] = useState(false);
    const [applicationsError, setApplicationsError] = useState('');
    const [isConfirmingUninstall, setIsConfirmingUninstall] = useState(false);
    const [isUninstalling, setIsUninstalling] = useState(false);

    async function chooseFile() {
        setIsChoosing(true);
        setStatus(null);
        try {
            const path = await SelectDebFile();
            if (path) setSelectedPath(path);
        } catch (error) {
            setStatus({success: false, message: String(error), output: ''});
        } finally {
            setIsChoosing(false);
        }
    }

    async function installPackage() {
        setIsInstalling(true);
        setStatus(null);
        setIsResultOpen(false);
        try {
            const result = await InstallDeb(selectedPath);
            setStatus(result);
            setIsResultOpen(true);
        } catch (error) {
            setStatus({success: false, message: String(error), output: ''});
            setIsResultOpen(true);
        } finally {
            setIsInstalling(false);
        }
    }

    async function loadApplications() {
        setIsLoadingApplications(true);
        setApplicationsError('');
        try {
            setApplications(await ListInstalledApplications());
        } catch (error) {
            setApplicationsError(String(error));
        } finally {
            setIsLoadingApplications(false);
        }
    }

    useEffect(() => {
        if (tab === 'uninstall') void loadApplications();
    }, [tab]);

    async function uninstallPackage() {
        if (!selectedPackage) return;
        setIsConfirmingUninstall(false);
        setIsUninstalling(true);
        try {
            const result = await UninstallPackage(selectedPackage.packageName);
            if (result.success) {
                setSelectedPackage(null);
                await loadApplications();
            } else {
                setApplicationsError(result.message);
            }
        } catch (error) {
            setApplicationsError(String(error));
        } finally {
            setIsUninstalling(false);
        }
    }

    function closeResult() {
        setIsResultOpen(false);
        setSelectedPath('');
        setStatus(null);
    }

    return (
        <main className="h-screen overflow-hidden bg-slate-950 px-3 py-3 text-slate-100">
            <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-black/30">
                <nav className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2" aria-label="Package actions">
                    {(['install', 'uninstall'] as const).map((item) => (
                        <button key={item} className={`flex-1 rounded-lg px-4 py-2.5 font-semibold uppercase tracking-wide transition ${tab === item ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`} onClick={() => setTab(item)} type="button">
                            {item}
                        </button>
                    ))}
                </nav>

                {tab === 'install' ? (
                    <>
                        <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <button className="rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60" disabled={isChoosing || isInstalling} onClick={chooseFile} type="button">{isChoosing ? 'Opening picker...' : 'Choose .deb file'}</button>
                                <button className="rounded-lg bg-emerald-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedPath || isInstalling || isChoosing} onClick={installPackage} type="button">{isInstalling ? 'Installing...' : 'Install / Reinstall'}</button>
                            </div>
                            <div className="mt-3 rounded-lg bg-slate-900 p-3 text-left"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected file</p><p className="mt-1 break-all font-mono text-xs text-slate-100">{selectedPath || 'No .deb file selected.'}</p></div>
                        </section>
                        <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p><div className={`mt-2 rounded-lg border p-3 ${status?.success ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-700 bg-slate-900'}`}><p className="font-medium">{status?.message || 'Ready to install.'}</p>{status?.output ? <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs text-slate-200">{status.output}</pre> : null}</div></section>
                    </>
                ) : (
                    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left">
                        <div className="flex items-center justify-between"><div><p className="text-lg font-semibold">Installed applications</p><p className="text-sm text-slate-400">Select an application to remove it.</p></div><button className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50" disabled={isLoadingApplications || isUninstalling} onClick={() => void loadApplications()} type="button">Refresh</button></div>
                        {applicationsError ? <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-rose-300">{applicationsError}</p> : null}
                        {isLoadingApplications ? <p className="mt-4 text-slate-400">Loading installed applications...</p> : applications.length === 0 && !applicationsError ? <p className="mt-4 text-slate-400">No removable applications were found.</p> : <div className="mt-4 min-h-0 space-y-2 overflow-y-auto">{applications.map((application) => <button key={application.packageName} className={`w-full rounded-lg border p-3 text-left transition ${selectedPackage?.packageName === application.packageName ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`} onClick={() => setSelectedPackage(application)} type="button"><span className="font-semibold">{application.packageName}</span><span className="ml-2 text-xs text-slate-400">{application.version}</span><span className="mt-1 block text-sm text-slate-400">{application.description || 'No description available.'}</span></button>)}</div>}
                        <button className="mt-4 rounded-lg bg-rose-500 px-4 py-2.5 font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedPackage || isUninstalling} onClick={() => setIsConfirmingUninstall(true)} type="button">{isUninstalling ? 'Uninstalling...' : 'Uninstall selected application'}</button>
                    </section>
                )}
            </div>

            {isInstalling ? <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm" role="status"><div className="installing-card flex w-full max-w-sm flex-col items-center rounded-2xl border border-cyan-400/30 bg-slate-900 p-8 text-center shadow-2xl"><span className="spinner" aria-hidden="true" /><h2 className="mt-5 text-xl font-semibold">Installing package...</h2><p className="mt-2 text-sm text-slate-400">Please wait while the package is installed.</p></div></div> : null}
            {isResultOpen && status ? <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"><div className="flex max-h-[min(36rem,calc(100vh-3rem))] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Installation result</p><h2 className="mt-1 text-xl font-semibold">{status.success ? 'Package installed successfully' : 'Package installation failed'}</h2></div><button aria-label="Close installation result" className="rounded-lg p-2 text-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100" onClick={closeResult} type="button">×</button></div><div className="overflow-y-auto p-5"><p className={status.success ? 'font-medium text-emerald-300' : 'font-medium text-rose-300'}>{status.message}</p>{status.output ? <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-4 text-xs">{status.output}</pre> : null}</div></div></div> : null}
            {isConfirmingUninstall && selectedPackage ? <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-900 p-5 shadow-2xl"><h2 className="text-xl font-semibold">Confirm uninstall</h2><p className="mt-3 text-slate-300">Uninstall <strong>{selectedPackage.packageName}</strong>? This action cannot be undone.</p><div className="mt-5 flex justify-end gap-2"><button className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800" onClick={() => setIsConfirmingUninstall(false)} type="button">Cancel</button><button className="rounded-lg bg-rose-500 px-4 py-2 font-semibold text-white hover:bg-rose-400" onClick={() => void uninstallPackage()} type="button">Confirm uninstall</button></div></div></div> : null}
        </main>
    );
}

export default App;
