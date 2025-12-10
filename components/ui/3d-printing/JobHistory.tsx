'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  Download,
  RotateCcw,
  Eye
} from 'lucide-react';
import { DirectPrintJob, DirectPrintJobStatus, PrintSettings } from '@/lib/types/direct-print-jobs';
import { Button } from '@/components/ui/Button';
import ReprintDialog from '@/components/ui/3d-printing/ReprintDialog';

interface JobHistoryProps {
  userId: string;
}

const JobHistory: React.FC<JobHistoryProps> = ({ userId }) => {
  const [jobs, setJobs] = useState<DirectPrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DirectPrintJobStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedJobForReprint, setSelectedJobForReprint] = useState<DirectPrintJob | null>(null);

  const itemsPerPage = 20;

  const fetchJobs = async (page: number = 1, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
      }

      const offset = (page - 1) * itemsPerPage;
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      
      const response = await fetch(
        `/api/3d-printing/history?userId=${userId}&limit=${itemsPerPage}&offset=${offset}${statusParam}`
      );
      const data = await response.json();

      if (data.success) {
        if (reset || page === 1) {
          setJobs(data.jobs || []);
        } else {
          setJobs(prev => [...prev, ...(data.jobs || [])]);
        }
        setTotalCount(data.totalCount || 0);
        setHasMore(data.hasMore || false);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to fetch job history');
      }
    } catch (err) {
      setError('Network error while fetching jobs');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchJobs(1, true);
  }, [userId, statusFilter]);

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchJobs(nextPage, false);
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    fetchJobs(1, true);
  };

  const handleDownloadModel = async (jobId: string, filename: string) => {
    try {
      const response = await fetch(`/api/3d-printing/download/${jobId}?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError(data.error?.message || 'Failed to download model');
      }
    } catch (err) {
      setError('Network error while downloading model');
      console.error('Download error:', err);
    }
  };

  const handleReprint = async (originalJobId: string, printSettings?: Partial<PrintSettings>) => {
    try {
      const response = await fetch('/api/3d-printing/reprint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalJobId,
          printSettings,
          userId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to the new job page
        window.location.href = `/3d-printing/job/${data.jobId}`;
      } else {
        throw new Error(data.error?.message || 'Failed to create reprint job');
      }
    } catch (err) {
      throw err; // Re-throw to be handled by ReprintDialog
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'printing':
        return <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <div className="w-4 h-4 bg-zinc-400 rounded-full" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'text-green-400 bg-green-950/20 border-green-500';
      case 'failed':
        return 'text-red-400 bg-red-950/20 border-red-500';
      case 'printing':
        return 'text-blue-400 bg-blue-950/20 border-blue-500';
      case 'pending':
        return 'text-yellow-400 bg-yellow-950/20 border-yellow-500';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-600';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredJobs = jobs.filter(job =>
    job.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && jobs.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-zinc-400">Loading job history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-zinc-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DirectPrintJobStatus | 'all')}
              className="bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="downloading">Downloading</option>
              <option value="slicing">Slicing</option>
              <option value="uploading">Uploading</option>
              <option value="printing">Printing</option>
              <option value="complete">Complete</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Refresh Button */}
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center space-x-6 text-sm text-zinc-400">
          <span>Total Jobs: {totalCount}</span>
          <span>Showing: {filteredJobs.length}</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-950/20 border border-red-500 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-red-300 font-medium">Error Loading History</p>
              <p className="text-red-400 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="bg-zinc-900 rounded-lg p-12 border border-zinc-700 text-center">
          <Clock className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 mb-2">No print jobs found</p>
          <p className="text-sm text-zinc-500">
            {searchTerm ? 'Try adjusting your search terms' : 'Upload a model to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
          <div className="divide-y divide-zinc-700">
            {filteredJobs.map((job) => (
              <div key={job.id} className="p-6 hover:bg-zinc-800 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Job Header */}
                    <div className="flex items-center space-x-3 mb-3">
                      {getStatusIcon(job.status)}
                      <h3 className="font-medium text-white truncate">
                        {job.filename}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(job.status)}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </div>

                    {/* Job Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-zinc-400 mb-3">
                      <div>
                        <span className="block text-zinc-500">Created</span>
                        <span>{formatDate(job.created_at)}</span>
                      </div>
                      <div>
                        <span className="block text-zinc-500">Size</span>
                        <span>{(job.file_size_bytes / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                      {job.model_metadata && (
                        <>
                          <div>
                            <span className="block text-zinc-500">Vertices</span>
                            <span>{job.model_metadata.vertices.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="block text-zinc-500">Faces</span>
                            <span>{job.model_metadata.faces.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Error Message */}
                    {job.error_message && (
                      <div className="bg-red-950/20 border border-red-500 rounded p-3 mb-3">
                        <p className="text-red-400 text-sm">{job.error_message}</p>
                      </div>
                    )}

                    {/* Print Settings */}
                    {job.print_settings && Object.keys(job.print_settings).length > 0 && (
                      <div className="text-sm text-zinc-400">
                        <span className="text-zinc-500">Settings: </span>
                        {job.print_settings.material && (
                          <span className="mr-3">{job.print_settings.material}</span>
                        )}
                        {job.print_settings.quality && (
                          <span className="mr-3">{job.print_settings.quality}</span>
                        )}
                        {job.print_settings.infill && (
                          <span>{job.print_settings.infill}% infill</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="ml-6 flex flex-col space-y-2">
                    <a
                      href={`/3d-printing/job/${job.id}`}
                      className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View Details</span>
                    </a>

                    <button 
                      onClick={() => handleDownloadModel(job.id, job.filename)}
                      className="flex items-center space-x-1 text-green-400 hover:text-green-300 transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>

                    {(job.status === 'complete' || job.status === 'failed') && (
                      <button 
                        onClick={() => setSelectedJobForReprint(job)}
                        className="flex items-center space-x-1 text-yellow-400 hover:text-yellow-300 transition-colors text-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Reprint</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="p-6 border-t border-zinc-700 text-center">
              <Button
                onClick={handleLoadMore}
                variant="outline"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  'Load More Jobs'
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Reprint Dialog */}
      {selectedJobForReprint && (
        <ReprintDialog
          job={selectedJobForReprint}
          isOpen={!!selectedJobForReprint}
          onClose={() => setSelectedJobForReprint(null)}
          onReprint={handleReprint}
        />
      )}
    </div>
  );
};

export default JobHistory;