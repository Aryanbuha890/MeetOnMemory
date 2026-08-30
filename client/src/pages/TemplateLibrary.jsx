import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar.jsx";
import {
  browseTemplates,
  cloneTemplate,
  rateTemplate,
} from "../services/templateLibraryApi";
import { CopyPlus, Star, ChevronDown, Filter, X } from "lucide-react";
import { toast } from "react-toastify";
import CloneMeetingModal from "../components/CloneMeetingModal";

const TemplateLibrary = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [ratingInput, setRatingInput] = useState(5);
  const [reviewInput, setReviewInput] = useState("");
  const [cloningTemplateId, setCloningTemplateId] = useState(null);
  const [ratingTemplateId, setRatingTemplateId] = useState(null);
  const [isInstantiateModalOpen, setIsInstantiateModalOpen] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await browseTemplates({
        category: categoryFilter,
        sort: sortOption,
      });
      setTemplates(data.templates || []);
    } catch (err) {
      setError("Failed to load templates");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, sortOption]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && selectedTemplate) {
        setSelectedTemplate(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTemplate]);

  const handleClone = async (templateId) => {
    if (cloningTemplateId) return;

    setCloningTemplateId(templateId);
    try {
      await cloneTemplate(templateId);
      toast.success("Template cloned successfully!");
      await fetchTemplates();
    } catch {
      toast.error("Failed to clone template");
    } finally {
      setCloningTemplateId(null);
    }
  };

  const handleRate = async (templateId) => {
    if (ratingTemplateId) return;

    setRatingTemplateId(templateId);
    try {
      await rateTemplate(templateId, {
        rating: ratingInput,
        review: reviewInput,
      });
      toast.success("Rating submitted successfully!");
      setRatingInput(5);
      setReviewInput("");
      await fetchTemplates();
      setSelectedTemplate(null);
    } catch {
      toast.error("Failed to submit rating");
    } finally {
      setRatingTemplateId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto pt-24 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Template Library
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Browse and clone meeting templates published by your organization.
            </p>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2 border border-gray-200 dark:border-gray-700">
              <Filter className="w-4 h-4 text-gray-500 mr-2" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="">All Categories</option>
                <option value="General">General</option>
                <option value="Engineering">Engineering</option>
                <option value="HR">HR</option>
                <option value="Sales">Sales</option>
              </select>
            </div>
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2 border border-gray-200 dark:border-gray-700">
              <ChevronDown className="w-4 h-4 text-gray-500 mr-2" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="newest">Newest</option>
                <option value="popular">Most Popular</option>
                <option value="highestRated">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-xl text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? null : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template._id}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${template.name}`}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={() => setSelectedTemplate(template)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedTemplate(template);
                  }
                }}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {template.name}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {template.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                    {template.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <CopyPlus className="w-4 h-4 mr-1" />
                      <span>{template.cloneCount ?? 0} clones</span>
                    </div>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 mr-1 text-yellow-400" />
                      <span>
                        {typeof template.averageRating === "number"
                          ? template.averageRating.toFixed(1)
                          : template.averageRating != null
                            ? Number(template.averageRating).toFixed(1)
                            : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {templates.length === 0 && !loading && !error && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-xl p-8 shadow-xs">
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No templates found in the library.
            </p>
          </div>
        )}
      </div>

      {selectedTemplate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-detail-title"
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 relative">
            <button
              type="button"
              onClick={() => setSelectedTemplate(null)}
              aria-label="Close dialog"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h2
              id="template-detail-title"
              className="text-2xl font-bold text-gray-900 dark:text-white mb-2 pr-8"
            >
              {selectedTemplate.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {selectedTemplate.description}
            </p>

            <div className="mb-6">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Agenda Blocks
              </h4>
              <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400">
                {selectedTemplate.agendaBlocks?.map((block, idx) => (
                  <li key={idx}>
                    {block.title} ({block.duration} min)
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => handleClone(selectedTemplate._id)}
                disabled={cloningTemplateId === selectedTemplate._id}
                aria-busy={cloningTemplateId === selectedTemplate._id}
                className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed text-gray-800 dark:text-white py-2 px-4 rounded-lg font-medium transition flex items-center justify-center cursor-pointer"
              >
                <CopyPlus className="w-5 h-5 mr-2" />
                {cloningTemplateId === selectedTemplate._id
                  ? "Cloning..."
                  : "Clone Template"}
              </button>
              <button
                onClick={() => setIsInstantiateModalOpen(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition flex items-center justify-center cursor-pointer"
              >
                Use This Template
              </button>
            </div>

            <hr className="border-gray-200 dark:border-gray-700 my-4" />

            <div>
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Rate this template
              </h4>
              <div className="flex items-center mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    disabled={Boolean(ratingTemplateId)}
                    className="p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer"
                    onClick={() => {
                      if (!ratingTemplateId) setRatingInput(star);
                    }}
                  >
                    <Star
                      className={`w-6 h-6 ${
                        ratingInput >= star
                          ? "text-yellow-400 fill-current"
                          : "text-gray-300 dark:text-gray-600"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewInput}
                onChange={(e) => setReviewInput(e.target.value)}
                placeholder="Leave a review..."
                disabled={ratingTemplateId === selectedTemplate._id}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm mb-2 dark:bg-gray-700 dark:text-white disabled:opacity-60"
                rows="3"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  disabled={Boolean(ratingTemplateId)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRate(selectedTemplate._id)}
                  disabled={ratingTemplateId === selectedTemplate._id}
                  aria-busy={ratingTemplateId === selectedTemplate._id}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition cursor-pointer"
                >
                  {ratingTemplateId === selectedTemplate._id
                    ? "Submitting..."
                    : "Submit Rating"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTemplate && (
        <CloneMeetingModal
          isOpen={isInstantiateModalOpen}
          onClose={() => setIsInstantiateModalOpen(false)}
          templateId={selectedTemplate._id}
        />
      )}
    </div>
  );
};

export default TemplateLibrary;
