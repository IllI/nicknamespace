/**
 * Help system service for managing tours, documentation, and contextual help
 */

import { 
  Tour, 
  TourStep, 
  HelpArticle, 
  FAQ, 
  ContextualHelp, 
  UserProgress, 
  HelpSearchResult 
} from '@/lib/types/help-system';

export class HelpSystemService {
  private static instance: HelpSystemService;
  private tours: Tour[] = [];
  private articles: HelpArticle[] = [];
  private faqs: FAQ[] = [];
  private contextualHelp: ContextualHelp[] = [];

  static getInstance(): HelpSystemService {
    if (!HelpSystemService.instance) {
      HelpSystemService.instance = new HelpSystemService();
    }
    return HelpSystemService.instance;
  }

  constructor() {
    this.initializeContent();
  }

  /**
   * Initialize help content
   */
  private initializeContent(): void {
    this.tours = this.getDefaultTours();
    this.articles = this.getDefaultArticles();
    this.faqs = this.getDefaultFAQs();
    this.contextualHelp = this.getDefaultContextualHelp();
  }

  /**
   * Get all available tours
   */
  getTours(category?: string): Tour[] {
    if (category) {
      return this.tours.filter(tour => tour.category === category);
    }
    return this.tours;
  }

  /**
   * Get a specific tour by ID
   */
  getTour(id: string): Tour | null {
    return this.tours.find(tour => tour.id === id) || null;
  }

  /**
   * Get help articles
   */
  getArticles(category?: string): HelpArticle[] {
    if (category) {
      return this.articles.filter(article => article.category === category);
    }
    return this.articles;
  }

  /**
   * Get a specific article by ID
   */
  getArticle(id: string): HelpArticle | null {
    return this.articles.find(article => article.id === id) || null;
  }

  /**
   * Get FAQs
   */
  getFAQs(category?: string): FAQ[] {
    let faqs = this.faqs;
    if (category) {
      faqs = faqs.filter(faq => faq.category === category);
    }
    // Sort by popularity
    return faqs.sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Search help content
   */
  search(query: string, limit: number = 10): HelpSearchResult[] {
    const results: HelpSearchResult[] = [];
    const searchTerms = query.toLowerCase().split(' ');

    // Search articles
    this.articles.forEach(article => {
      const relevance = this.calculateRelevance(searchTerms, [
        article.title,
        article.content,
        ...article.tags
      ]);
      
      if (relevance > 0) {
        results.push({
          type: 'article',
          id: article.id,
          title: article.title,
          excerpt: this.createExcerpt(article.content, searchTerms),
          relevanceScore: relevance,
          category: article.category,
          url: `/help/articles/${article.id}`
        });
      }
    });

    // Search FAQs
    this.faqs.forEach(faq => {
      const relevance = this.calculateRelevance(searchTerms, [
        faq.question,
        faq.answer,
        ...faq.tags
      ]);
      
      if (relevance > 0) {
        results.push({
          type: 'faq',
          id: faq.id,
          title: faq.question,
          excerpt: this.createExcerpt(faq.answer, searchTerms),
          relevanceScore: relevance + (faq.popularity * 0.1), // Boost popular FAQs
          category: faq.category,
          url: `/help/faq#${faq.id}`
        });
      }
    });

    // Search tours
    this.tours.forEach(tour => {
      const relevance = this.calculateRelevance(searchTerms, [
        tour.name,
        tour.description
      ]);
      
      if (relevance > 0) {
        results.push({
          type: 'tour',
          id: tour.id,
          title: tour.name,
          excerpt: tour.description,
          relevanceScore: relevance,
          category: tour.category,
          url: `/help/tours/${tour.id}`
        });
      }
    });

    // Sort by relevance and return top results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Get contextual help for a specific trigger
   */
  getContextualHelp(trigger: string, userProgress?: UserProgress): ContextualHelp[] {
    return this.contextualHelp.filter(help => {
      // Check if trigger matches
      if (help.trigger !== trigger) return false;

      // Check show conditions
      if (help.showCondition && userProgress) {
        const condition = help.showCondition;
        
        // Check if user has dismissed this help
        if (userProgress.dismissedHelp.includes(help.id)) return false;

        // Check user type condition
        if (condition.userType) {
          const userType = this.determineUserType(userProgress);
          if (userType !== condition.userType) return false;
        }

        // Check feature usage condition
        if (condition.featureUsage !== undefined) {
          // This would need to be implemented based on usage tracking
          // For now, we'll assume it passes
        }
      }

      return true;
    });
  }

  /**
   * Mark tour as completed for user
   */
  async markTourCompleted(userId: string, tourId: string): Promise<void> {
    // In a real implementation, this would save to database
    console.log(`Tour ${tourId} completed by user ${userId}`);
  }

  /**
   * Mark article as viewed
   */
  async markArticleViewed(userId: string, articleId: string): Promise<void> {
    // In a real implementation, this would save to database
    console.log(`Article ${articleId} viewed by user ${userId}`);
  }

  /**
   * Dismiss contextual help
   */
  async dismissHelp(userId: string, helpId: string): Promise<void> {
    // In a real implementation, this would save to database
    console.log(`Help ${helpId} dismissed by user ${userId}`);
  }

  /**
   * Get user progress
   */
  async getUserProgress(userId: string): Promise<UserProgress> {
    // In a real implementation, this would load from database
    return {
      userId,
      completedTours: [],
      viewedArticles: [],
      dismissedHelp: [],
      preferences: {
        showTooltips: true,
        showOnboarding: true,
        helpLevel: 'standard'
      },
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * Calculate relevance score for search
   */
  private calculateRelevance(searchTerms: string[], content: string[]): number {
    let score = 0;
    const combinedContent = content.join(' ').toLowerCase();

    searchTerms.forEach(term => {
      // Exact matches get higher score
      const exactMatches = (combinedContent.match(new RegExp(term, 'g')) || []).length;
      score += exactMatches * 2;

      // Partial matches get lower score
      const partialMatches = (combinedContent.match(new RegExp(term.substring(0, Math.max(3, term.length - 2)), 'g')) || []).length;
      score += partialMatches * 0.5;
    });

    return score;
  }

  /**
   * Create excerpt with highlighted search terms
   */
  private createExcerpt(content: string, searchTerms: string[], maxLength: number = 200): string {
    const words = content.split(' ');
    let excerpt = '';
    let foundTerm = false;

    // Try to find a sentence with search terms
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (searchTerms.some(term => word.includes(term))) {
        // Start excerpt from a few words before the match
        const start = Math.max(0, i - 10);
        const end = Math.min(words.length, start + 30);
        excerpt = words.slice(start, end).join(' ');
        foundTerm = true;
        break;
      }
    }

    // If no terms found, use beginning of content
    if (!foundTerm) {
      excerpt = words.slice(0, 30).join(' ');
    }

    // Truncate if too long
    if (excerpt.length > maxLength) {
      excerpt = excerpt.substring(0, maxLength) + '...';
    }

    return excerpt;
  }

  /**
   * Determine user type based on progress
   */
  private determineUserType(progress: UserProgress): 'new' | 'returning' | 'experienced' {
    const completedTours = progress.completedTours.length;
    const viewedArticles = progress.viewedArticles.length;

    if (completedTours === 0 && viewedArticles === 0) {
      return 'new';
    } else if (completedTours < 3 && viewedArticles < 10) {
      return 'returning';
    } else {
      return 'experienced';
    }
  }

  /**
   * Get default tours
   */
  private getDefaultTours(): Tour[] {
    return [
      {
        id: 'first-upload',
        name: 'Your First 3D Model Upload',
        description: 'Learn how to upload and print your first 3D model',
        category: 'onboarding',
        estimatedDuration: 5,
        difficulty: 'beginner',
        steps: [
          {
            id: 'welcome',
            target: '.upload-area',
            title: 'Welcome to 3D Printing!',
            content: 'Let\'s walk through uploading your first 3D model. This area is where you\'ll drag and drop your files.',
            placement: 'bottom',
            showNext: true,
            showSkip: true
          },
          {
            id: 'file-formats',
            target: '.file-format-info',
            title: 'Supported File Formats',
            content: 'We support STL, OBJ, and PLY files. STL is the most common format for 3D printing.',
            placement: 'top',
            showNext: true,
            showPrev: true
          },
          {
            id: 'upload-file',
            target: '.upload-button',
            title: 'Upload Your Model',
            content: 'Click here to select a file, or drag and drop it into the upload area.',
            placement: 'bottom',
            action: { type: 'click' },
            showNext: true,
            showPrev: true
          },
          {
            id: 'validation',
            target: '.validation-results',
            title: 'Model Validation',
            content: 'We\'ll automatically check your model for printability and show any issues here.',
            placement: 'left',
            showNext: true,
            showPrev: true
          },
          {
            id: 'print-settings',
            target: '.print-settings',
            title: 'Print Settings',
            content: 'Choose your material, quality, and other print settings. Don\'t worry, the defaults work great!',
            placement: 'right',
            showNext: true,
            showPrev: true
          },
          {
            id: 'submit-job',
            target: '.submit-button',
            title: 'Submit for Printing',
            content: 'When you\'re ready, click here to submit your job to the printer queue.',
            placement: 'top',
            showNext: true,
            showPrev: true
          },
          {
            id: 'track-progress',
            target: '.job-tracker',
            title: 'Track Your Print',
            content: 'You can monitor your print job progress here. You\'ll get real-time updates!',
            placement: 'bottom',
            showPrev: true
          }
        ]
      },
      {
        id: 'advanced-features',
        name: 'Advanced 3D Printing Features',
        description: 'Explore advanced features like custom settings and batch printing',
        category: 'feature',
        estimatedDuration: 8,
        difficulty: 'intermediate',
        prerequisites: ['first-upload'],
        steps: [
          {
            id: 'custom-settings',
            target: '.advanced-settings',
            title: 'Custom Print Settings',
            content: 'Access advanced settings for fine-tuning your prints.',
            placement: 'right',
            showNext: true,
            showSkip: true
          },
          {
            id: 'material-selection',
            target: '.material-selector',
            title: 'Material Selection',
            content: 'Choose from different materials like PLA, PETG, ABS, and TPU.',
            placement: 'bottom',
            showNext: true,
            showPrev: true
          },
          {
            id: 'quality-settings',
            target: '.quality-selector',
            title: 'Quality Settings',
            content: 'Adjust layer height and print speed for different quality levels.',
            placement: 'top',
            showNext: true,
            showPrev: true
          },
          {
            id: 'support-settings',
            target: '.support-options',
            title: 'Support Structures',
            content: 'Enable supports for overhangs and complex geometries.',
            placement: 'left',
            showPrev: true
          }
        ]
      },
      {
        id: 'troubleshooting',
        name: 'Troubleshooting Common Issues',
        description: 'Learn how to resolve common 3D printing problems',
        category: 'troubleshooting',
        estimatedDuration: 10,
        difficulty: 'intermediate',
        steps: [
          {
            id: 'file-errors',
            target: '.error-display',
            title: 'Understanding File Errors',
            content: 'Learn what different error messages mean and how to fix them.',
            placement: 'center',
            showNext: true,
            showSkip: true
          },
          {
            id: 'model-repair',
            target: '.validation-details',
            title: 'Model Repair',
            content: 'Use these validation details to identify and fix model issues.',
            placement: 'right',
            showNext: true,
            showPrev: true
          },
          {
            id: 'print-failures',
            target: '.job-status',
            title: 'Print Failure Recovery',
            content: 'When prints fail, check the status details for specific error information.',
            placement: 'bottom',
            showPrev: true
          }
        ]
      }
    ];
  }

  /**
   * Get default help articles
   */
  private getDefaultArticles(): HelpArticle[] {
    return [
      {
        id: 'getting-started',
        title: 'Getting Started with 3D Printing',
        content: `# Getting Started with 3D Printing

Welcome to our 3D printing service! This guide will help you get started with uploading and printing your first 3D model.

## What You'll Need

- A 3D model file (STL, OBJ, or PLY format)
- Basic understanding of 3D printing concepts
- Patience for your first print!

## Step-by-Step Process

### 1. Prepare Your Model
Make sure your 3D model is:
- Properly scaled (check dimensions)
- Manifold (watertight mesh)
- Oriented correctly for printing

### 2. Upload Your File
- Drag and drop your file into the upload area
- Wait for automatic validation
- Review any warnings or errors

### 3. Configure Print Settings
- Choose your material (PLA recommended for beginners)
- Select quality level (Standard is usually fine)
- Enable supports if needed

### 4. Submit and Track
- Submit your job to the print queue
- Monitor progress in real-time
- Receive notifications when complete

## Tips for Success

- Start with simple models
- Use PLA material for your first prints
- Check model dimensions before uploading
- Read error messages carefully

Need more help? Check out our FAQ section or contact support.`,
        category: 'getting-started',
        tags: ['beginner', 'upload', 'basics'],
        difficulty: 'beginner',
        estimatedReadTime: 5,
        lastUpdated: new Date().toISOString(),
        relatedArticles: ['file-formats', 'print-settings']
      },
      {
        id: 'file-formats',
        title: 'Supported File Formats',
        content: `# Supported File Formats

Our 3D printing service supports three main file formats:

## STL (STereoLithography)
- **Most common** format for 3D printing
- Contains only mesh geometry (triangles)
- Binary or ASCII format
- **Recommended** for most users

## OBJ (Wavefront OBJ)
- Supports textures and materials (ignored for printing)
- Human-readable text format
- Good for complex models
- Larger file sizes than STL

## PLY (Polygon File Format)
- Can store color information
- Supports both binary and ASCII
- Less common but fully supported
- Good for scanned models

## File Size Limits
- Maximum file size: **50MB**
- Recommended: Keep under 10MB for faster processing
- Large files may take longer to upload and process

## Conversion Tools
If your model is in a different format:
- **Blender** (free) - Export as STL/OBJ
- **Fusion 360** - Export as STL
- **Tinkercad** - Download as STL
- **MeshLab** - Convert between formats

## Best Practices
- Use **binary STL** for smaller file sizes
- Avoid extremely high-resolution meshes
- Check file integrity before uploading`,
        category: 'technical',
        tags: ['formats', 'stl', 'obj', 'ply', 'conversion'],
        difficulty: 'beginner',
        estimatedReadTime: 3,
        lastUpdated: new Date().toISOString(),
        relatedArticles: ['getting-started', 'model-preparation']
      },
      {
        id: 'print-settings',
        title: 'Understanding Print Settings',
        content: `# Understanding Print Settings

Print settings control how your model is manufactured. Here's what each setting does:

## Material Selection

### PLA (Polylactic Acid)
- **Best for beginners**
- Easy to print, biodegradable
- Good surface finish
- Temperature: 190-220°C

### PETG (Polyethylene Terephthalate Glycol)
- Strong and flexible
- Chemical resistant
- Clear when printed thin
- Temperature: 220-250°C

### ABS (Acrylonitrile Butadiene Styrene)
- Very strong and durable
- Higher temperature resistance
- Requires heated bed
- Temperature: 220-250°C

### TPU (Thermoplastic Polyurethane)
- Flexible and rubber-like
- Difficult to print
- Great for phone cases, gaskets
- Temperature: 210-230°C

## Quality Settings

### Draft (0.3mm layers)
- **Fastest** printing
- Visible layer lines
- Good for prototypes

### Standard (0.2mm layers)
- **Recommended** for most prints
- Good balance of speed and quality
- Suitable for functional parts

### Fine (0.1mm layers)
- **Highest quality**
- Smooth surface finish
- Takes 2-3x longer to print

## Support Structures
- Enable for overhangs > 45°
- Required for bridges and floating parts
- Adds print time and material usage
- May leave marks on surface

## Advanced Settings
- **Infill**: Internal density (20% is usually enough)
- **Print Speed**: Slower = better quality
- **Layer Height**: Thinner = smoother surface`,
        category: 'settings',
        tags: ['materials', 'quality', 'supports', 'advanced'],
        difficulty: 'intermediate',
        estimatedReadTime: 7,
        lastUpdated: new Date().toISOString(),
        relatedArticles: ['getting-started', 'troubleshooting']
      }
    ];
  }

  /**
   * Get default FAQs
   */
  private getDefaultFAQs(): FAQ[] {
    return [
      {
        id: 'upload-failed',
        question: 'Why did my file upload fail?',
        answer: 'File uploads can fail for several reasons: 1) File too large (max 50MB), 2) Unsupported format (use STL, OBJ, or PLY), 3) Corrupted file, 4) Network connection issues. Check the error message for specific details.',
        category: 'upload',
        tags: ['upload', 'error', 'file-size'],
        popularity: 95,
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'print-time',
        question: 'How long does it take to print my model?',
        answer: 'Print time depends on model size, complexity, and quality settings. Small models (< 5cm) typically take 1-3 hours, medium models (5-15cm) take 3-8 hours, and large models can take 8-24 hours. You\'ll see an estimated time after uploading.',
        category: 'printing',
        tags: ['time', 'duration', 'estimate'],
        popularity: 88,
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'material-choice',
        question: 'Which material should I choose?',
        answer: 'For beginners, we recommend PLA - it\'s easy to print and works for most applications. Choose PETG for stronger parts, ABS for high-temperature resistance, or TPU for flexible items. Each material has different properties and print requirements.',
        category: 'materials',
        tags: ['material', 'pla', 'petg', 'abs', 'tpu'],
        popularity: 82,
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'model-validation',
        question: 'What does "model validation failed" mean?',
        answer: 'Model validation checks if your file is printable. Common issues include: non-manifold geometry (holes in the mesh), inverted normals, or models that exceed our build volume (256×256×256mm). Check the validation details for specific problems and repair suggestions.',
        category: 'validation',
        tags: ['validation', 'error', 'manifold', 'repair'],
        popularity: 76,
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'supports-needed',
        question: 'When do I need support structures?',
        answer: 'Enable supports for: overhangs greater than 45°, bridges longer than 5mm, and any floating parts. Supports add print time and may leave marks, but they\'re necessary for complex geometries. Our system will recommend supports when needed.',
        category: 'settings',
        tags: ['supports', 'overhangs', 'bridges'],
        popularity: 71,
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'file-formats',
        question: 'What file formats do you accept?',
        answer: 'We accept STL, OBJ, and PLY files up to 50MB. STL is the most common and recommended format. If you have a different format, use software like Blender, Fusion 360, or MeshLab to convert it to STL.',
        category: 'formats',
        tags: ['formats', 'stl', 'obj', 'ply', 'conversion'],
        popularity: 69,
        lastUpdated: new Date().toISOString()
      }
    ];
  }

  /**
   * Get default contextual help
   */
  private getDefaultContextualHelp(): ContextualHelp[] {
    return [
      {
        id: 'upload-area-help',
        trigger: '.upload-area',
        title: 'Upload Your 3D Model',
        content: 'Drag and drop your STL, OBJ, or PLY file here, or click to browse. Maximum file size is 50MB.',
        type: 'tooltip',
        position: 'bottom',
        showCondition: {
          userType: 'new'
        }
      },
      {
        id: 'validation-help',
        trigger: '.validation-results',
        title: 'Model Validation Results',
        content: 'This shows if your model is ready for printing. Red items need to be fixed, yellow items are warnings.',
        type: 'popover',
        position: 'right',
        showCondition: {
          userType: 'new'
        }
      },
      {
        id: 'print-settings-help',
        trigger: '.print-settings',
        title: 'Print Settings',
        content: 'Choose your material and quality. PLA with Standard quality is recommended for beginners.',
        type: 'tooltip',
        position: 'top',
        showCondition: {
          userType: 'new'
        }
      },
      {
        id: 'job-status-help',
        trigger: '.job-status',
        title: 'Job Status',
        content: 'Track your print progress here. You\'ll see real-time updates as your model moves through the printing pipeline.',
        type: 'popover',
        position: 'left'
      }
    ];
  }
}

// Export singleton instance
export const helpSystem = HelpSystemService.getInstance();