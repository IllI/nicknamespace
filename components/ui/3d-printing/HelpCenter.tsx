'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Book, 
  HelpCircle, 
  Play, 
  Clock, 
  Tag,
  ChevronRight,
  ExternalLink,
  Star,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Tour, 
  HelpArticle, 
  FAQ, 
  HelpSearchResult 
} from '@/lib/types/help-system';
import { helpSystem } from '@/lib/services/help-system-service';
import { TourLauncher } from './GuidedTour';

interface HelpCenterProps {
  className?: string;
  defaultTab?: 'search' | 'articles' | 'faq' | 'tours';
}

export function HelpCenter({ className = '', defaultTab = 'search' }: HelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpSearchResult[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Load initial data
    setArticles(helpSystem.getArticles());
    setFaqs(helpSystem.getFAQs());
    setTours(helpSystem.getTours());
  }, []);

  useEffect(() => {
    // Perform search when query changes
    if (searchQuery.trim()) {
      setIsSearching(true);
      const results = helpSystem.search(searchQuery, 20);
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const filteredArticles = selectedCategory === 'all' 
    ? articles 
    : articles.filter(article => article.category === selectedCategory);

  const filteredFAQs = selectedCategory === 'all'
    ? faqs
    : faqs.filter(faq => faq.category === selectedCategory);

  const filteredTours = selectedCategory === 'all'
    ? tours
    : tours.filter(tour => tour.category === selectedCategory);

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'getting-started', label: 'Getting Started' },
    { value: 'upload', label: 'File Upload' },
    { value: 'printing', label: 'Printing' },
    { value: 'materials', label: 'Materials' },
    { value: 'settings', label: 'Settings' },
    { value: 'troubleshooting', label: 'Troubleshooting' },
    { value: 'technical', label: 'Technical' }
  ];

  return (
    <div className={`max-w-6xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Help Center</h1>
        <p className="text-gray-600">
          Find answers, learn new features, and get the most out of 3D printing
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <Input
          type="text"
          placeholder="Search for help articles, FAQs, or tutorials..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 py-3 text-lg"
        />
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search" className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <span>Search</span>
          </TabsTrigger>
          <TabsTrigger value="articles" className="flex items-center space-x-2">
            <Book className="h-4 w-4" />
            <span>Articles</span>
          </TabsTrigger>
          <TabsTrigger value="faq" className="flex items-center space-x-2">
            <HelpCircle className="h-4 w-4" />
            <span>FAQ</span>
          </TabsTrigger>
          <TabsTrigger value="tours" className="flex items-center space-x-2">
            <Play className="h-4 w-4" />
            <span>Tours</span>
          </TabsTrigger>
        </TabsList>

        {/* Search Results */}
        <TabsContent value="search" className="space-y-4">
          {searchQuery ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Search Results for "{searchQuery}"
                </h2>
                <span className="text-gray-500">
                  {searchResults.length} results
                </span>
              </div>
              
              {searchResults.length > 0 ? (
                <div className="space-y-4">
                  {searchResults.map((result) => (
                    <SearchResultCard key={result.id} result={result} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No results found
                  </h3>
                  <p className="text-gray-600">
                    Try different keywords or browse our categories below
                  </p>
                </div>
              )}
            </div>
          ) : (
            <QuickStartSection />
          )}
        </TabsContent>

        {/* Articles */}
        <TabsContent value="articles" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Help Articles</h2>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredFAQs.map((faq) => (
              <FAQCard key={faq.id} faq={faq} />
            ))}
          </div>
        </TabsContent>

        {/* Tours */}
        <TabsContent value="tours" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Interactive Tours</h2>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTours.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuickStartSection() {
  const popularArticles = helpSystem.getArticles().slice(0, 3);
  const popularFAQs = helpSystem.getFAQs().slice(0, 5);
  const onboardingTours = helpSystem.getTours('onboarding');

  return (
    <div className="space-y-8">
      {/* Quick Start Tours */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Get Started</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {onboardingTours.map((tour) => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
      </section>

      {/* Popular Articles */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Popular Articles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      {/* Common Questions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Common Questions</h2>
        <div className="space-y-3">
          {popularFAQs.map((faq) => (
            <FAQCard key={faq.id} faq={faq} compact />
          ))}
        </div>
      </section>
    </div>
  );
}

function SearchResultCard({ result }: { result: HelpSearchResult }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'article':
        return <Book className="h-4 w-4" />;
      case 'faq':
        return <HelpCircle className="h-4 w-4" />;
      case 'tour':
        return <Play className="h-4 w-4" />;
      default:
        return <Book className="h-4 w-4" />;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-1">
            {getTypeIcon(result.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-medium text-gray-900 truncate">
                {result.title}
              </h3>
              <Badge variant="outline" className="text-xs">
                {result.type}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              {result.excerpt}
            </p>
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {result.category}
              </Badge>
              <Button variant="ghost" size="sm" asChild>
                <a href={result.url}>
                  View <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArticleCard({ article }: { article: HelpArticle }) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg leading-tight">
            {article.title}
          </CardTitle>
          <Badge className={getDifficultyColor(article.difficulty)}>
            {article.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
          <span className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            {article.estimatedReadTime} min read
          </span>
          <Badge variant="outline">{article.category}</Badge>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-4">
          {article.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>

        <Button variant="outline" className="w-full" asChild>
          <a href={`/help/articles/${article.id}`}>
            Read Article
            <ChevronRight className="h-4 w-4 ml-2" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function FAQCard({ faq, compact = false }: { faq: FAQ; compact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  return (
    <Card className={compact ? '' : 'hover:shadow-md transition-shadow'}>
      <CardContent className={compact ? 'p-4' : 'p-6'}>
        <div 
          className="flex items-start justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className={`font-medium text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
            {faq.question}
          </h3>
          <div className="flex items-center space-x-2 ml-4">
            {faq.popularity > 80 && (
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
            )}
            <ChevronRight 
              className={`h-4 w-4 text-gray-400 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`} 
            />
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className={`text-gray-600 ${compact ? 'text-sm' : 'text-base'}`}>
              {faq.answer}
            </p>
            <div className="flex items-center justify-between mt-3">
              <Badge variant="outline" className="text-xs">
                {faq.category}
              </Badge>
              <span className="text-xs text-gray-400">
                Updated {new Date(faq.lastUpdated).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TourCard({ tour }: { tour: Tour }) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg leading-tight">
            {tour.name}
          </CardTitle>
          <Badge className={getDifficultyColor(tour.difficulty)}>
            {tour.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-gray-600 mb-4">
          {tour.description}
        </p>
        
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
          <span className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            {tour.estimatedDuration} min
          </span>
          <span className="flex items-center">
            <Play className="h-4 w-4 mr-1" />
            {tour.steps.length} steps
          </span>
        </div>

        <TourLauncher tourId={tour.id}>
          <Button className="w-full">
            <Play className="h-4 w-4 mr-2" />
            Start Tour
          </Button>
        </TourLauncher>
      </CardContent>
    </Card>
  );
}