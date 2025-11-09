import { useState, useMemo, useRef, useEffect } from 'react'
import { Bell, Upload, FileText } from 'lucide-react'
import './App.css'

// Typewriter effect hook
const useTypewriter = (text: string, speed: number = 50, startDelay: number = 0) => {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    setDisplayedText('')
    setIsComplete(false)
    
    let intervalId: NodeJS.Timeout | null = null
    
    const timer = setTimeout(() => {
      let currentIndex = 0
      intervalId = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1))
          currentIndex++
        } else {
          setIsComplete(true)
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
      }, speed)
    }, startDelay)

    return () => {
      clearTimeout(timer)
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [text, speed, startDelay])

  return { displayedText, isComplete }
}

interface DateItem {
  date: Date
  day: number
  month: number
  year: number
  monthName: string
}

function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  
  // Typewriter effects - only show loading text when loading screen is visible
  const landingOverview = useTypewriter('A journey through your cherished moments, captured in time.', 30, 500)
  const loadingText = useTypewriter(showLoading ? 'Putting your memories together...' : '', 40, 200)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [scrollingDate, setScrollingDate] = useState<Date | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [isCenterImageHeld, setIsCenterImageHeld] = useState(false)
  const [borderProgress, setBorderProgress] = useState(0)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [modalVideoUrl, setModalVideoUrl] = useState<string>('/hero.mp4')
  const sliderRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const modalVideoRef = useRef<HTMLVideoElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const hasCentered = useRef(false)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const hasMoved = useRef(false)
  const clickTarget = useRef<HTMLElement | null>(null)
  const justDragged = useRef(false)
  const imageClickStarts = useRef<Map<string, { x: number; y: number; time: number }>>(new Map())
  const centerImageHoldTimer = useRef<number | null>(null)
  const borderAnimationFrame = useRef<number | null>(null)
  const lastCenterClickTime = useRef<number>(0)

  // 3D card rotation state (user drag)
  const [cardRotations, setCardRotations] = useState<{
    left: { rotateX: number; rotateY: number }
    center: { rotateX: number; rotateY: number }
    right: { rotateX: number; rotateY: number }
  }>({
    left: { rotateX: 0, rotateY: 0 },
    center: { rotateX: 0, rotateY: 0 },
    right: { rotateX: 0, rotateY: 0 },
  })

  // Idle animation state (floating effect)
  const [idleAnimations, setIdleAnimations] = useState<{
    left: { rotateX: number; rotateY: number; phase: number }
    center: { rotateX: number; rotateY: number; phase: number }
    right: { rotateX: number; rotateY: number; phase: number }
  }>({
    left: { rotateX: 0, rotateY: 0, phase: 0 },
    center: { rotateX: 0, rotateY: 0, phase: Math.PI * 0.33 },
    right: { rotateX: 0, rotateY: 0, phase: Math.PI * 0.66 },
  })

  // Entry animation state
  const [entryAnimation, setEntryAnimation] = useState<{
    center: 'hidden' | 'falling' | 'complete'
    left: 'hidden' | 'sliding' | 'complete'
    right: 'hidden' | 'sliding' | 'complete'
  }>({
    center: 'hidden',
    left: 'hidden',
    right: 'hidden',
  })

  // Card drag state
  const cardDragState = useRef<{
    isDragging: boolean
    cardPosition: 'left' | 'center' | 'right' | null
    cardElement: HTMLElement | null
    startX: number
    startY: number
    currentX: number
    currentY: number
  }>({
    isDragging: false,
    cardPosition: null,
    cardElement: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  })

  // Get today's date for comparison
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  // Generate dates from December 2023 to October 2025
  const allDates = useMemo(() => {
    const dateList: DateItem[] = []
    const startYear = 2023
    const endYear = 2025
    const startMonth = 11 // December (0-indexed)
    const endMonth = 9 // October (0-indexed)

    // Start from December 2023
    for (let year = startYear; year <= endYear; year++) {
      const startM = year === startYear ? startMonth : 0
      const endM = year === endYear ? endMonth : 11
      
      for (let month = startM; month <= endM; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day)
          dateList.push({
            date,
            day,
            month,
            year,
            monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          })
        }
      }
    }

    return dateList
  }, [])

  // Group dates by month
  const datesByMonth = useMemo(() => {
    const grouped: { [key: string]: DateItem[] } = {}
    allDates.forEach((dateItem) => {
      if (!grouped[dateItem.monthName]) {
        grouped[dateItem.monthName] = []
      }
      grouped[dateItem.monthName].push(dateItem)
    })
    return grouped
  }, [allDates])

  // Get all month names in order
  const allMonthNames = useMemo(() => {
    return [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
  }, [])

  // Get display months from datesByMonth (includes year)
  const displayMonths = useMemo(() => {
    // Sort months chronologically
    const monthKeys = Object.keys(datesByMonth).sort((a, b) => {
      const dateA = datesByMonth[a][0].date
      const dateB = datesByMonth[b][0].date
      return dateA.getTime() - dateB.getTime()
    })
    return monthKeys
  }, [datesByMonth])

  // Get date day number to display for each month (only show circle for selected date, not today)
  const getCurrentDateForMonth = (monthName: string): number | null => {
    if (!selectedDate) return null
    
    // monthName now includes year (e.g., "December 2023")
    const normalizedSelected = normalizeDate(selectedDate)
    const selectedMonthName = normalizedSelected.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    if (selectedMonthName === monthName) {
      return normalizedSelected.getDate()
    }
    
    return null
  }

  // Count memories (images) for each month
  const getMemoryCountForMonth = (monthName: string): number => {
    // monthName now includes year (e.g., "December 2023")
    return sampleImages.filter(img => {
      const imgDate = normalizeDate(img.date)
      const imgMonthName = imgDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      return imgMonthName === monthName && isDateValid(imgDate)
    }).length
  }

  // Get current year
  const currentYear = today.getFullYear()

  // Normalize dates to midnight for comparison
  const normalizeDate = (d: Date): Date => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  // Get cutoff date (October 31, 2025)
  const cutoffDate = useMemo(() => {
    return new Date(2025, 9, 31) // October 31, 2025 (month is 0-indexed, so 9 = October)
  }, [])

  // Get start date (December 1, 2023)
  const startDate = useMemo(() => {
    return new Date(2023, 11, 1) // December 1, 2023 (month is 0-indexed, so 11 = December)
  }, [])

  // Check if a date is valid (between December 1, 2023 and October 31, 2025)
  const isDateValid = (date: Date): boolean => {
    const normalizedDate = normalizeDate(date)
    return normalizedDate >= startDate && normalizedDate <= cutoffDate
  }

  // Sample image data with URLs, dates, captions, and video URLs
  // Dates spread from December 2023 to October 2025
  const sampleImages = useMemo(() => {
    return [
      {
        url: '/10.JPG',
        date: new Date(2023, 11, 15), // December 15, 2023
        caption: 'Waterpark Day',
        videoUrl: '/hero.mp4' // Fallback to hero video since no video for image 10
      },
      {
        url: '/4.jpg',
        date: new Date(2024, 2, 1), // March 1, 2024
        caption: 'College Move-In Day',
        videoUrl: '/video_with_4_ref.mp4'
      },
      {
        url: '/5.JPG',
        date: new Date(2024, 4, 15), // May 15, 2024
        caption: 'Game Night in Atlanta',
        videoUrl: '/video_with_5_ref.mp4'
      },
      {
        url: '/6.JPG',
        date: new Date(2024, 7, 1), // August 1, 2024
        caption: 'Switzerland Sunrise',
        videoUrl: '/video_with_6_ref.mp4'
      },
      {
        url: '/7.jpg',
        date: new Date(2024, 9, 15), // October 15, 2024
        caption: 'Georgia Tech Orientation',
        videoUrl: '/video_with_7_ref.mp4'
      },
      {
        url: '/8.JPG',
        date: new Date(2025, 0, 1), // January 1, 2025
        caption: 'Family Gathering',
        videoUrl: '/video_with_8_ref.mp4'
      },
      {
        url: '/9.JPG',
        date: new Date(2025, 3, 15), // April 15, 2025
        caption: 'Anniversary Celebration',
        videoUrl: '/video_with_9_ref.mp4'
      },
    ]
  }, [])

  // Find which image corresponds to the selected date
  const getImageForDate = (date: Date): number => {
    const normalizedSelected = normalizeDate(date)
    
    // First, check if date is valid (not after Nov 9th)
    if (!isDateValid(normalizedSelected)) {
      // If date is invalid, use cutoff date (Nov 9th)
      const normalizedValid = normalizeDate(cutoffDate)
      // Find closest image to valid date
      let closestIndex = 0
      let closestDiff = Infinity
      
      sampleImages.forEach((img, index) => {
        const imgDate = normalizeDate(img.date)
        if (imgDate <= normalizedValid) {
          const diff = normalizedValid.getTime() - imgDate.getTime()
          if (diff < closestDiff) {
            closestDiff = diff
            closestIndex = index
          }
        }
      })
      
      return closestDiff === Infinity ? 0 : closestIndex
    }
    
    // Find image with matching date (normalized)
    const imageIndex = sampleImages.findIndex(img => {
      const imgDate = normalizeDate(img.date)
      return imgDate.getTime() === normalizedSelected.getTime()
    })
    
    // If no exact match, find closest image by date (only looking backwards or at the date)
    if (imageIndex === -1) {
      let closestIndex = 0
      let closestDiff = Infinity
      
      sampleImages.forEach((img, index) => {
        const imgDate = normalizeDate(img.date)
        // Only consider images that are on or before the selected date
        if (imgDate <= normalizedSelected) {
          const diff = normalizedSelected.getTime() - imgDate.getTime()
          if (diff < closestDiff) {
            closestDiff = diff
            closestIndex = index
          }
        }
      })
      
      // If no image found before the date, use the first image
      if (closestDiff === Infinity) {
        return 0
      }
      
      return closestIndex
    }
    
    return imageIndex
  }

  // Get center image index based on selected date or directly selected image
  const centerImageIndex = useMemo(() => {
    // If an image is directly selected (clicked), use that index
    if (selectedImageIndex !== null) {
      return selectedImageIndex
    }
    // Otherwise, use date-based selection
    const dateToUse = selectedDate || today
    return getImageForDate(dateToUse)
  }, [selectedImageIndex, selectedDate, today, sampleImages, cutoffDate])

  // Get ordered images (center, left, right) - non-circular
  const orderedImages = useMemo(() => {
    if (sampleImages.length === 0) return []
    
    const images = []
    
    // Left image - only if not at the first image
    if (centerImageIndex > 0) {
      images.push({ ...sampleImages[centerImageIndex - 1], position: 'left' as const })
    }
    
    // Center image - always present
    images.push({ ...sampleImages[centerImageIndex], position: 'center' as const })
    
    // Right image - only if not at the last image
    if (centerImageIndex < sampleImages.length - 1) {
      images.push({ ...sampleImages[centerImageIndex + 1], position: 'right' as const })
    }
    
    return images
  }, [centerImageIndex, sampleImages])

  // Handle image click to center it
  const handleImageClick = (imageDate: Date) => {
    // Don't handle click if we're dragging
    if (cardDragState.current.isDragging) {
      return
    }
    
    // Find the index of the clicked image in sampleImages
    const clickedImageIndex = sampleImages.findIndex(img => {
      const imgDate = normalizeDate(img.date)
      const clickedDate = normalizeDate(imageDate)
      return imgDate.getTime() === clickedDate.getTime()
    })
    
    if (clickedImageIndex !== -1) {
      // Set the selected image index (this will override date-based selection)
      setSelectedImageIndex(clickedImageIndex)
      // Clear selected date so image selection takes precedence
      setSelectedDate(null)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (centerImageHoldTimer.current) {
        clearTimeout(centerImageHoldTimer.current)
      }
      if (borderAnimationFrame.current) {
        cancelAnimationFrame(borderAnimationFrame.current)
      }
    }
  }, [])

  // Border animation when center image is held (works even during drag)
  // Also support double-click to open video modal
  const handleCenterImageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const centerImage = sampleImages[centerImageIndex]
    if (centerImage && centerImage.videoUrl) {
      setModalVideoUrl(centerImage.videoUrl)
    }
    setShowVideoModal(true)
  }
  useEffect(() => {
    if (!isCenterImageHeld) {
      setBorderProgress(0)
      if (borderAnimationFrame.current) {
        cancelAnimationFrame(borderAnimationFrame.current)
        borderAnimationFrame.current = null
      }
      return
    }

    const BORDER_ANIMATION_DURATION = 2000 // 2 seconds to complete border
    const startTime = Date.now()

    const animate = () => {
      // Continue animation even if dragging - only stop if hold is released
      if (!isCenterImageHeld) {
        setBorderProgress(0)
        if (borderAnimationFrame.current) {
          cancelAnimationFrame(borderAnimationFrame.current)
          borderAnimationFrame.current = null
        }
        return
      }

      const elapsed = Date.now() - startTime
      const progress = Math.min(100, (elapsed / BORDER_ANIMATION_DURATION) * 100)
      setBorderProgress(progress)

      if (progress < 100) {
        borderAnimationFrame.current = requestAnimationFrame(animate)
      } else {
        // Border complete - show video modal with current center image's video
        const centerImage = sampleImages[centerImageIndex]
        if (centerImage && centerImage.videoUrl) {
          setModalVideoUrl(centerImage.videoUrl)
          console.log('Setting video URL:', centerImage.videoUrl, 'for image:', centerImage.caption)
        } else {
          console.warn('No video URL found for center image:', centerImageIndex)
        }
        setShowVideoModal(true)
        setIsCenterImageHeld(false)
        setBorderProgress(0)
      }
    }

    borderAnimationFrame.current = requestAnimationFrame(animate)

    return () => {
      if (borderAnimationFrame.current) {
        cancelAnimationFrame(borderAnimationFrame.current)
      }
    }
  }, [isCenterImageHeld, centerImageIndex, sampleImages])

  // Handle launch button - animate logo and bring up timeline
  const handleLaunch = () => {
    setIsAnimating(true)
    // After logo animation, show loading message
    setTimeout(() => {
      setShowLanding(false)
      setShowLoading(true)
      // After loading message, show main app
      setTimeout(() => {
        setShowLoading(false)
        setIsAnimating(false)
      }, 2000) // Show loading for 2 seconds
    }, 1000) // Logo animation duration
  }

  const closeVideoModal = () => {
    setShowVideoModal(false)
    // Pause video when modal closes
    if (modalVideoRef.current) {
      modalVideoRef.current.pause()
    }
  }

  // Ensure video plays when modal opens
  useEffect(() => {
    if (showVideoModal && modalVideoRef.current) {
      const video = modalVideoRef.current
      video.load() // Reload video to ensure it plays
      video.play().catch(err => {
        console.error('Error playing video:', err)
      })
    }
  }, [showVideoModal, modalVideoUrl])

  const handleDateClick = (dateItem: DateItem) => {
    // Only allow clicking on valid dates (up to Nov 9th)
    if (isDateValid(dateItem.date)) {
      setSelectedDate(dateItem.date)
      // Clear image selection so date-based selection takes over
      setSelectedImageIndex(null)
      setScrollingDate(dateItem.date) // Track the date we're scrolling to
      
      // Scroll to center the selected date with smooth animation
      setTimeout(() => {
        const dateElement = containerRef.current?.querySelector(
          `[data-date-key="${dateItem.monthName}-${dateItem.day}"]`
        ) as HTMLElement

        if (dateElement && sliderRef.current) {
          const slider = sliderRef.current
          const sliderRect = slider.getBoundingClientRect()
          const elementRect = dateElement.getBoundingClientRect()
          const elementCenter = elementRect.left + elementRect.width / 2
          const sliderCenter = sliderRect.left + sliderRect.width / 2
          const scrollPosition = slider.scrollLeft + (elementCenter - sliderCenter)
          
          // Start scroll animation
          slider.scrollTo({
            left: Math.max(0, scrollPosition),
            behavior: 'smooth'
          })

          // Clear scrolling state after animation completes
          let scrollTimeout: number
          let lastScrollLeft = slider.scrollLeft
          let scrollEndCount = 0
          
          const handleScroll = () => {
            // Check if scroll has stopped
            if (Math.abs(slider.scrollLeft - lastScrollLeft) < 1) {
              scrollEndCount++
              if (scrollEndCount > 2) {
                // Scroll has stopped, ensure perfect centering
                const finalDateElement = containerRef.current?.querySelector(
                  `[data-date-key="${dateItem.monthName}-${dateItem.day}"]`
                ) as HTMLElement
                
                if (finalDateElement) {
                  const finalSliderRect = slider.getBoundingClientRect()
                  const finalElementRect = finalDateElement.getBoundingClientRect()
                  const finalElementCenter = finalElementRect.left + finalElementRect.width / 2
                  const finalSliderCenter = finalSliderRect.left + finalSliderRect.width / 2
                  const finalScrollPosition = slider.scrollLeft + (finalElementCenter - finalSliderCenter)
                  
                  // Fine-tune positioning if needed
                  if (Math.abs(finalElementCenter - finalSliderCenter) > 2) {
                    slider.scrollTo({
                      left: Math.max(0, finalScrollPosition),
                      behavior: 'smooth'
                    })
                  }
                }
                
                setScrollingDate(null)
                slider.removeEventListener('scroll', handleScroll)
                return
              }
            } else {
              scrollEndCount = 0
            }
            
            lastScrollLeft = slider.scrollLeft
            clearTimeout(scrollTimeout)
            scrollTimeout = window.setTimeout(() => {
              setScrollingDate(null)
              slider.removeEventListener('scroll', handleScroll)
            }, 300)
          }
          
          slider.addEventListener('scroll', handleScroll, { passive: true })
          
          // Fallback timeout
          setTimeout(() => {
            setScrollingDate(null)
            slider.removeEventListener('scroll', handleScroll)
          }, 1500)
        }
      }, 50)
    }
  }

  const isDateSelected = (dateItem: DateItem) => {
    if (!selectedDate) return false
    const normalizedItem = normalizeDate(dateItem.date)
    const normalizedSelected = normalizeDate(selectedDate)
    return normalizedItem.getTime() === normalizedSelected.getTime()
  }

  const isToday = (dateItem: DateItem) => {
    const normalizedItem = normalizeDate(dateItem.date)
    const normalizedToday = normalizeDate(today)
    return normalizedItem.getTime() === normalizedToday.getTime()
  }

  // Find current date item for centering
  const currentDateItem = useMemo(() => {
    return allDates.find(item => isToday(item)) || null
  }, [allDates, today])

  // Entry animation sequence - trigger on mount and date change
  useEffect(() => {
    // Reset animation state
    setEntryAnimation({
      center: 'hidden',
      left: 'hidden',
      right: 'hidden',
    })

    // Start center falling animation after a brief delay
    const centerTimeout = setTimeout(() => {
      setEntryAnimation(prev => ({
        ...prev,
        center: 'falling',
      }))
    }, 100)

    // Start side animations after center animation starts (0.6s delay for center fall)
    const sideTimeout = setTimeout(() => {
      setEntryAnimation(prev => ({
        ...prev,
        left: 'sliding',
        right: 'sliding',
      }))
    }, 700) // 100ms initial + 600ms center animation

    // Mark all animations as complete after side animations finish (0.5s for slide)
    // Add a small delay to ensure smooth transition to idle animation
    const completeTimeout = setTimeout(() => {
      setEntryAnimation({
        center: 'complete',
        left: 'complete',
        right: 'complete',
      })
    }, 1300) // 100ms + 600ms center + 500ms side + 100ms buffer

    return () => {
      clearTimeout(centerTimeout)
      clearTimeout(sideTimeout)
      clearTimeout(completeTimeout)
    }
  }, [selectedDate, centerImageIndex]) // Trigger when date changes or center image changes

  // Set video playback speed
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const setPlaybackRate = () => {
      video.playbackRate = 0.8 // 0.8x speed (slower than normal)
    }

    // Set immediately if video is already loaded
    if (video.readyState >= 2) {
      setPlaybackRate()
    }

    // Also set when video metadata is loaded
    video.addEventListener('loadedmetadata', setPlaybackRate)
    video.addEventListener('canplay', setPlaybackRate)

    return () => {
      video.removeEventListener('loadedmetadata', setPlaybackRate)
      video.removeEventListener('canplay', setPlaybackRate)
    }
  }, [])

  // Center current date on mount (only once) - but only if no date is selected
  useEffect(() => {
    if (hasCentered.current || !sliderRef.current || !containerRef.current || !currentDateItem || selectedDate) {
      return
    }

    // Wait for DOM to render
    const timeoutId = setTimeout(() => {
      const currentDateElement = containerRef.current?.querySelector(
        `[data-date-key="${currentDateItem.monthName}-${currentDateItem.day}"]`
      ) as HTMLElement

      if (currentDateElement && sliderRef.current) {
        const slider = sliderRef.current
        const sliderRect = slider.getBoundingClientRect()
        const elementRect = currentDateElement.getBoundingClientRect()
        const elementCenter = elementRect.left + elementRect.width / 2
        const sliderCenter = sliderRect.left + sliderRect.width / 2
        const scrollPosition = slider.scrollLeft + (elementCenter - sliderCenter)
        
        slider.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: 'auto' // Instant on first load
        })
        hasCentered.current = true
      }
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [currentDateItem, selectedDate])

  // Track hovered elements
  const hoveredElements = useRef<Set<HTMLElement>>(new Set())

  // Add scroll-based animation for date lines (scale based on proximity to center)
  useEffect(() => {
    const slider = sliderRef.current
    if (!slider || !containerRef.current) return

    const updateDateLineSizes = () => {
      if (!slider || !containerRef.current) return

      const sliderRect = slider.getBoundingClientRect()
      const sliderCenter = sliderRect.left + sliderRect.width / 2

      const dateWrappers = containerRef.current.querySelectorAll('.date-line-wrapper')
      dateWrappers.forEach((wrapper) => {
        const element = wrapper as HTMLElement
        const rect = element.getBoundingClientRect()
        const elementCenter = rect.left + rect.width / 2
        const distance = Math.abs(elementCenter - sliderCenter)
        const maxDistance = sliderRect.width / 2
        const proximity = Math.max(0, 1 - distance / maxDistance)
        
        // Scale based on proximity (closer to center = bigger)
        const scale = 1 + (proximity * 0.3) // Scale from 1.0 to 1.3
        const opacity = 0.5 + (proximity * 0.5) // Opacity from 0.5 to 1.0
        
        const dateLine = element.querySelector('.date-line') as HTMLElement
        const isHovered = hoveredElements.current.has(element)
        const isSelected = element.classList.contains('selected')
        const isScrollingTo = element.classList.contains('scrolling-to')
        const isCurrentDate = element.classList.contains('current-date')
        const isDisabled = element.classList.contains('disabled')
        
        // Don't apply proximity scaling to hovered, selected, scrolling, current date, or disabled elements
        // Let CSS handle hover, selected, and scrolling states
        if (dateLine && !isSelected && !isScrollingTo && !isCurrentDate && !isHovered && !isDisabled) {
          // Apply proximity-based scaling
          dateLine.style.transform = `scaleY(${scale})`
          dateLine.style.opacity = `${opacity}`
        } else if (dateLine && !isHovered && !isSelected && !isScrollingTo) {
          // For special states (except hover/selected/scrolling), clear inline styles to let CSS take over
          dateLine.style.transform = ''
          dateLine.style.opacity = ''
        }
      })
    }

    // Use event delegation to track hover state (works with dynamically rendered elements)
    const handleMouseEnter = (e: Event) => {
      const target = (e.target as HTMLElement).closest('.date-line-wrapper') as HTMLElement
      if (target) {
        hoveredElements.current.add(target)
        updateDateLineSizes()
      }
    }

    const handleMouseLeave = (e: Event) => {
      const target = (e.target as HTMLElement).closest('.date-line-wrapper') as HTMLElement
      if (target) {
        hoveredElements.current.delete(target)
        updateDateLineSizes()
      }
    }

    // Use event delegation on the container
    const container = containerRef.current
    if (container) {
      container.addEventListener('mouseenter', handleMouseEnter, true)
      container.addEventListener('mouseleave', handleMouseLeave, true)
    }

    let animationFrameId: number
    const handleScroll = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      animationFrameId = requestAnimationFrame(updateDateLineSizes)
    }

    slider.addEventListener('scroll', handleScroll, { passive: true })
    updateDateLineSizes() // Initial update

    return () => {
      slider.removeEventListener('scroll', handleScroll)
      if (container) {
        container.removeEventListener('mouseenter', handleMouseEnter, true)
        container.removeEventListener('mouseleave', handleMouseLeave, true)
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      hoveredElements.current.clear()
    }
  }, [])

  // Add drag functionality
  useEffect(() => {
    const slider = sliderRef.current
    if (!slider) return

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      clickTarget.current = target.closest('.date-line-wrapper') as HTMLElement
      hasMoved.current = false
      
      isDragging.current = true
      const rect = slider.getBoundingClientRect()
      startX.current = e.pageX - rect.left
      scrollLeft.current = slider.scrollLeft
      slider.style.cursor = 'grabbing'
      slider.style.userSelect = 'none'
    }

    const handleMouseLeave = () => {
      if (isDragging.current) {
        isDragging.current = false
        slider.style.cursor = 'grab'
        slider.style.userSelect = 'auto'
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging.current) return
      
      // If we didn't move much, it was a click - trigger click on target
      if (!hasMoved.current && clickTarget.current && slider.contains(e.target as Node)) {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        clickTarget.current.dispatchEvent(clickEvent)
      }
      
      isDragging.current = false
      hasMoved.current = false
      clickTarget.current = null
      slider.style.cursor = 'grab'
      slider.style.userSelect = 'auto'
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      
      const rect = slider.getBoundingClientRect()
      const x = e.pageX - rect.left
      const deltaX = x - startX.current
      
      // If moved more than 5px, it's a drag
      if (Math.abs(deltaX) > 5) {
        hasMoved.current = true
        e.preventDefault()
        const walk = deltaX * 0.8 // Scroll speed multiplier - reduced for slower movement
        slider.scrollLeft = scrollLeft.current - walk
      }
    }

    // Touch events for mobile
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      clickTarget.current = target.closest('.date-line-wrapper') as HTMLElement
      hasMoved.current = false
      
      isDragging.current = true
      const rect = slider.getBoundingClientRect()
      startX.current = e.touches[0].pageX - rect.left
      scrollLeft.current = slider.scrollLeft
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return
      
      const rect = slider.getBoundingClientRect()
      const x = e.touches[0].pageX - rect.left
      const deltaX = x - startX.current
      
      // If moved more than 10px, it's a drag
      if (Math.abs(deltaX) > 10) {
        hasMoved.current = true
        e.preventDefault()
        const walk = deltaX * 0.8 // Scroll speed multiplier - reduced for slower movement
        slider.scrollLeft = scrollLeft.current - walk
      }
    }

    const handleTouchEnd = () => {
      // If we didn't move much, it was a tap - trigger click on target
      if (!hasMoved.current && clickTarget.current) {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        clickTarget.current.dispatchEvent(clickEvent)
      }
      
      isDragging.current = false
      hasMoved.current = false
      clickTarget.current = null
    }

    slider.addEventListener('mousedown', handleMouseDown)
    slider.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousemove', handleMouseMove)
    slider.addEventListener('touchstart', handleTouchStart, { passive: true })
    slider.addEventListener('touchmove', handleTouchMove, { passive: false })
    slider.addEventListener('touchend', handleTouchEnd)

    return () => {
      slider.removeEventListener('mousedown', handleMouseDown)
      slider.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousemove', handleMouseMove)
      slider.removeEventListener('touchstart', handleTouchStart)
      slider.removeEventListener('touchmove', handleTouchMove)
      slider.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  // Idle animation loop (floating effect)
  useEffect(() => {
    let animationFrameId: number
    let lastTime = performance.now()
    const ANIMATION_SPEED = 0.0004 // Speed of animation (radians per ms) - reduced for slower movement
    const MAX_IDLE_ROTATION = 8 // Maximum idle rotation in degrees
    const AMPLITUDE_X = 1.2 // Amplitude for X rotation
    const AMPLITUDE_Y = 1.5 // Amplitude for Y rotation

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      setIdleAnimations(prev => {
        // Only animate if no card is being dragged
        if (cardDragState.current.isDragging) {
          return prev
        }

        return {
          left: {
            rotateX: Math.sin(prev.left.phase) * MAX_IDLE_ROTATION * AMPLITUDE_X,
            rotateY: Math.cos(prev.left.phase * 0.7) * MAX_IDLE_ROTATION * AMPLITUDE_Y,
            phase: prev.left.phase + ANIMATION_SPEED * deltaTime,
          },
          center: {
            // Center image doesn't have idle animation - keep it at 0
            rotateX: 0,
            rotateY: 0,
            phase: prev.center.phase,
          },
          right: {
            rotateX: Math.sin(prev.right.phase) * MAX_IDLE_ROTATION * AMPLITUDE_X,
            rotateY: Math.cos(prev.right.phase * 0.7) * MAX_IDLE_ROTATION * AMPLITUDE_Y,
            phase: prev.right.phase + ANIMATION_SPEED * deltaTime,
          },
        }
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [])

  // 3D Card drag handlers
  useEffect(() => {
    const MAX_ROTATION = 25 // Maximum rotation in degrees

    const handleCardMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const cardElement = target.closest('.image-slot') as HTMLElement
      if (!cardElement) return

      const position = cardElement.classList.contains('image-slot-left') ? 'left' :
                      cardElement.classList.contains('image-slot-center') ? 'center' :
                      cardElement.classList.contains('image-slot-right') ? 'right' : null

      if (!position) return

      // For left/right images, allow React handlers to process clicks first
      // Only start drag if it's the center image or if it's actually a drag (not a click)
      if (position === 'left' || position === 'right') {
        // Don't prevent default immediately for side images - let click handlers work
        // We'll only start dragging if mouse moves significantly
        cardDragState.current = {
          isDragging: false, // Start as false, will be set to true on movement
          cardPosition: position,
          cardElement: cardElement,
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        }
        
        return // Let React handlers process the click
      }

      // For center image, allow clicks/double-clicks to work - only start drag on movement
      // Don't prevent default to allow React click handlers to process clicks
      justDragged.current = false // Reset drag flag
      
      cardDragState.current = {
        isDragging: false, // Start as false, will be set to true on movement
        cardPosition: position,
        cardElement: cardElement,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      }
      // Don't set pointer events here - let React handlers work
    }

    const handleCardMouseMove = (e: MouseEvent) => {
      if (!cardDragState.current.cardPosition || !cardDragState.current.cardElement) return

      const position = cardDragState.current.cardPosition
      const movedDistance = Math.sqrt(
        Math.pow(e.clientX - cardDragState.current.startX, 2) + 
        Math.pow(e.clientY - cardDragState.current.startY, 2)
      )

      // For left/right images, only start dragging if mouse moved significantly (more than 10px)
      // This allows clicks to work without interference
      if (!cardDragState.current.isDragging) {
        if (position === 'left' || position === 'right') {
          if (movedDistance > 10) {
            // Now it's a drag, start dragging
            cardDragState.current.isDragging = true
            const cardElement = cardDragState.current.cardElement
            cardElement.style.cursor = 'grabbing'
            cardElement.style.transition = 'none'
            cardElement.style.userSelect = 'none'
            justDragged.current = true
          } else {
            // Not enough movement, don't drag yet - allow click to work
            return
          }
        } else if (position === 'center') {
          // Center image: only start dragging if moved significantly
          // This allows border animation to work while holding without moving
          if (movedDistance > 5) {
            cardDragState.current.isDragging = true
            justDragged.current = true
            const cardElement = cardDragState.current.cardElement
            if (cardElement) {
              cardElement.style.cursor = 'grabbing'
              cardElement.style.transition = 'none'
              cardElement.style.userSelect = 'none'
            }
          } else {
            // Small movement - allow border animation to continue, don't start drag yet
            return
          }
        }
      }

      // If we're not dragging, don't process movement
      if (!cardDragState.current.isDragging) return

      e.preventDefault() // Prevent default drag behavior
      e.stopPropagation()

      const cardElement = cardDragState.current.cardElement
      const rect = cardElement.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // Calculate rotation based on mouse position relative to card center
      // rotateY: left/right movement (positive = rotate right)
      // rotateX: up/down movement (positive = rotate down, negative = rotate up)
      const deltaX = (e.clientX - centerX) / (rect.width / 2) // Normalized to -1 to 1
      const deltaY = (e.clientY - centerY) / (rect.height / 2) // Normalized to -1 to 1

      if (movedDistance > 10) {
        justDragged.current = true
      }

      const rotateY = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, deltaX * MAX_ROTATION))
      const rotateX = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, -deltaY * MAX_ROTATION))

      setCardRotations(prev => ({
        ...prev,
        [cardDragState.current.cardPosition!]: { rotateX, rotateY },
      }))

      cardDragState.current.currentX = e.clientX
      cardDragState.current.currentY = e.clientY
    }

    const handleCardMouseUp = () => {
      const position = cardDragState.current.cardPosition
      const cardElement = cardDragState.current.cardElement
      const wasDragging = cardDragState.current.isDragging
      
      if (wasDragging && position && cardElement) {
        // Re-enable transition for smooth spring-back and idle animation
        cardElement.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        cardElement.style.cursor = ''
        cardElement.style.userSelect = '' // Re-enable text selection
        
        // Spring back to original position (idle animation will continue smoothly)
        setCardRotations(prev => ({
          ...prev,
          [position]: { rotateX: 0, rotateY: 0 },
        }))
      }

      // Clear drag flag after a short delay to prevent click after drag
      if (wasDragging) {
        setTimeout(() => {
          justDragged.current = false
        }, 100)
      } else {
        justDragged.current = false
      }

      // Reset drag state
      cardDragState.current = {
        isDragging: false,
        cardPosition: null,
        cardElement: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      }
    }

    // Touch handlers for mobile
    const handleCardTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      const cardElement = target.closest('.image-slot') as HTMLElement
      if (!cardElement) return

      const position = cardElement.classList.contains('image-slot-left') ? 'left' :
                      cardElement.classList.contains('image-slot-center') ? 'center' :
                      cardElement.classList.contains('image-slot-right') ? 'right' : null

      if (!position) return

      e.preventDefault()
      e.stopPropagation()
      const touch = e.touches[0]
      
      cardDragState.current = {
        isDragging: false, // Start as false, will be set to true on movement
        cardPosition: position,
        cardElement: cardElement,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
      }
      cardElement.style.pointerEvents = 'auto' // Ensure pointer events work
    }

    const handleCardTouchMove = (e: TouchEvent) => {
      if (!cardDragState.current.cardPosition || !cardDragState.current.cardElement) return

      const touch = e.touches[0]
      const movedDistance = Math.sqrt(
        Math.pow(touch.clientX - cardDragState.current.startX, 2) + 
        Math.pow(touch.clientY - cardDragState.current.startY, 2)
      )

      // Only start dragging if moved significantly
      if (!cardDragState.current.isDragging) {
        if (movedDistance > 10) {
          cardDragState.current.isDragging = true
          const cardElement = cardDragState.current.cardElement
          cardElement.style.transition = 'none'
        } else {
          // Small movement - allow border animation to continue
          return
        }
      }

      // If we're not dragging, don't process movement
      if (!cardDragState.current.isDragging) return

      e.preventDefault() // Prevent default scroll/pan behavior
      e.stopPropagation()

      const cardElement = cardDragState.current.cardElement
      const rect = cardElement.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // Calculate rotation based on touch position relative to card center
      const deltaX = (touch.clientX - centerX) / (rect.width / 2) // Normalized to -1 to 1
      const deltaY = (touch.clientY - centerY) / (rect.height / 2) // Normalized to -1 to 1

      const rotateY = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, deltaX * MAX_ROTATION))
      const rotateX = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, -deltaY * MAX_ROTATION))

      setCardRotations(prev => ({
        ...prev,
        [cardDragState.current.cardPosition!]: { rotateX, rotateY },
      }))

      cardDragState.current.currentX = touch.clientX
      cardDragState.current.currentY = touch.clientY
    }

    const handleCardTouchEnd = () => {
      if (!cardDragState.current.isDragging) {
        // Reset state even if not dragging
        cardDragState.current = {
          isDragging: false,
          cardPosition: null,
          cardElement: null,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
        }
        return
      }

      const position = cardDragState.current.cardPosition
      const cardElement = cardDragState.current.cardElement
      if (position && cardElement) {
        // Re-enable transition for smooth spring-back and idle animation
        cardElement.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        
        setCardRotations(prev => ({
          ...prev,
          [position]: { rotateX: 0, rotateY: 0 },
        }))
      }

      cardDragState.current = {
        isDragging: false,
        cardPosition: null,
        cardElement: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      }
    }

    // Use event delegation on the image container
    const imageContainer = imageContainerRef.current
    if (imageContainer) {
      imageContainer.addEventListener('mousedown', handleCardMouseDown as EventListener)
      document.addEventListener('mousemove', handleCardMouseMove as EventListener, { passive: false })
      document.addEventListener('mouseup', handleCardMouseUp)
      imageContainer.addEventListener('touchstart', handleCardTouchStart as EventListener, { passive: false })
      imageContainer.addEventListener('touchmove', handleCardTouchMove as EventListener, { passive: false })
      imageContainer.addEventListener('touchend', handleCardTouchEnd)
    }

    return () => {
      if (imageContainer) {
        imageContainer.removeEventListener('mousedown', handleCardMouseDown as EventListener)
        document.removeEventListener('mousemove', handleCardMouseMove as EventListener)
        document.removeEventListener('mouseup', handleCardMouseUp)
        imageContainer.removeEventListener('touchstart', handleCardTouchStart as EventListener)
        imageContainer.removeEventListener('touchmove', handleCardTouchMove as EventListener)
        imageContainer.removeEventListener('touchend', handleCardTouchEnd)
      }
    }
  }, [])

  return (
    <div className="app">
      <div className="video-container">
        <video ref={videoRef} autoPlay muted loop playsInline>
          <source src="/hero.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Landing Page */}
      {showLanding && (
        <div className={`landing-page ${isAnimating ? 'landing-page-exiting' : ''}`}>
          <div className="landing-content">
            <div className="landing-logo-container">
              <img src="/logo.png" alt="Memento" className={`landing-logo ${isAnimating ? 'landing-logo-animating' : ''}`} />
            </div>
            <div className="landing-overview">
              <p className="landing-text">
                {landingOverview.displayedText}
                {landingOverview.displayedText.length > 0 && <span className="typewriter-cursor">|</span>}
              </p>
            </div>
            <button className="launch-button" onClick={handleLaunch} disabled={!landingOverview.isComplete}>
              Launch
            </button>
          </div>
        </div>
      )}

      {/* Loading Screen */}
      {showLoading && (
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-logo">
              <img src="/logo.png" alt="Memento" className="loading-logo-img" />
            </div>
            <p className="loading-text">
              {loadingText.displayedText}
              {loadingText.displayedText.length > 0 && <span className="typewriter-cursor">|</span>}
            </p>
            <div className="loading-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className={`sidebar ${showLanding || showLoading ? 'sidebar-hidden' : ''}`}>
        <button className="sidebar-icon-button sidebar-user-button">
          <img src="/user.jpeg" alt="User" className="sidebar-user-avatar" />
        </button>
        <div className="sidebar-divider"></div>
        <button className="sidebar-icon-button">
          <Bell size={24} />
        </button>
        <button className="sidebar-icon-button">
          <Upload size={24} />
        </button>
        <button className="sidebar-icon-button">
          <FileText size={24} />
        </button>
      </aside>

      {/* Top Header */}
      {!showVideoModal && (
        <header className={`header ${showLanding || showLoading ? 'header-hidden' : 'header-visible'}`}>
          <div className="header-center">
            <img src="/logo.png" alt="Memento" className={`app-title ${isAnimating && !showLoading ? 'app-title-animating' : ''}`} />
          </div>
        </header>
      )}

      {/* Main Content - Three Image Slots */}
      <div className={`image-container ${showLanding || showLoading ? 'image-container-hidden' : ''}`} ref={imageContainerRef}>
        {orderedImages.map((image) => {
          const imageDateStr = image.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          const wordCount = image.caption.split(/\s+/).filter(word => word.length > 0).length
          const isCenter = image.position === 'center'
          const shouldBeLarge = isCenter && wordCount <= 4
          const rotation = cardRotations[image.position]
          const idle = idleAnimations[image.position]
          const isDragging = cardDragState.current.isDragging && cardDragState.current.cardPosition === image.position
          
          // Base rotation for card position (left: -20deg, center: 0deg, right: 20deg)
          const baseRotationY = image.position === 'left' ? -20 : image.position === 'right' ? 20 : 0
          
          // Combine base rotation with idle animation and drag rotation
          // Center image doesn't get idle animation - only drag rotation applies
          // When dragging, use only drag rotation. When not dragging, blend idle animation (except for center)
          const finalRotateX = isDragging 
            ? rotation.rotateX 
            : image.position === 'center' 
              ? rotation.rotateX 
              : rotation.rotateX + idle.rotateX
          const finalRotateY = isDragging
            ? baseRotationY + rotation.rotateY
            : image.position === 'center'
              ? baseRotationY + rotation.rotateY
              : baseRotationY + rotation.rotateY + idle.rotateY
          
          const transformStyle = {
            transform: `perspective(1000px) rotateX(${finalRotateX}deg) rotateY(${finalRotateY}deg)`,
            transformStyle: 'preserve-3d' as const,
          }
          
          // Determine animation class based on entry animation state
          const animationState = entryAnimation[image.position]
          const animationClass = 
            animationState === 'hidden' ? 'entry-hidden' :
            animationState === 'falling' ? 'entry-falling' :
            animationState === 'sliding' ? 'entry-sliding' :
            'entry-complete'

          // Only apply transform if animation is complete (so idle animation can take over)
          const shouldApplyTransform = animationState === 'complete'
          
          const handleSlotClick = (e: React.MouseEvent) => {
            // Don't handle single click if it's part of a double click
            // React's onDoubleClick will handle double clicks
            if (image.position === 'center') {
              // Single click on center image - do nothing (only double click opens video modal)
              e.stopPropagation()
              e.preventDefault()
            } else {
              // Single click on left/right images centers them
              e.stopPropagation()
              e.preventDefault()
              handleImageClick(image.date)
            }
          }
          
          const handleSlotDoubleClick = (e: React.MouseEvent) => {
            // Double click on center image opens video modal
            if (image.position === 'center') {
              e.stopPropagation()
              e.preventDefault()
              // Cancel any pending single click
              lastCenterClickTime.current = 0
              handleCenterImageDoubleClick(e)
            }
          }
          
          // Handle double tap on mobile
          const handleSlotTouchEnd = (e: React.TouchEvent) => {
            if (image.position === 'center') {
              const now = Date.now()
              const timeSinceLastTap = now - lastCenterClickTime.current
              
              if (timeSinceLastTap < 400 && timeSinceLastTap > 0 && lastCenterClickTime.current > 0) {
                // Double tap detected - open video modal
                e.stopPropagation()
                e.preventDefault()
                lastCenterClickTime.current = 0
                handleCenterImageDoubleClick(e as any)
              } else {
                // First tap - wait to see if second tap comes
                lastCenterClickTime.current = now
              }
            }
          }
          
          return (
            <div 
              key={`${image.url}-${image.position}-${image.date.getTime()}`}
              className={`image-slot image-slot-${image.position} ${animationClass}`}
              style={shouldApplyTransform ? transformStyle : {}}
              onClick={handleSlotClick}
              onDoubleClick={handleSlotDoubleClick}
              onTouchEnd={handleSlotTouchEnd}
            >
              <img src={image.url} alt={image.position} />
              <div className={`image-caption ${shouldBeLarge ? 'caption-large' : ''}`}>
                <span className={`caption-text ${shouldBeLarge ? 'caption-text-large' : ''}`}>{image.caption}</span>
                {isDateValid(image.date) && (
                  <span className={`caption-date ${shouldBeLarge ? 'caption-date-large' : ''}`}>{imageDateStr}</span>
                )}
        </div>
        </div>
          )
        })}
      </div>

      {/* Bottom Date Slider */}
      <div className={`date-slider ${showLanding || showLoading ? 'date-slider-hidden' : 'date-slider-visible'}`} ref={sliderRef}>
        <div className="date-slider-container" ref={containerRef}>
          {displayMonths.map((monthName) => {
            const currentDateForMonth = getCurrentDateForMonth(monthName)
            const memoryCount = getMemoryCountForMonth(monthName)
            return (
            <div key={monthName} className="month-group">
              <div className="month-header">
                  {currentDateForMonth !== null && (
                    <div className="month-date-circle">
                      {currentDateForMonth}
                    </div>
                  )}
                  <span className="month-name">{monthName}</span>
              </div>
              <div className="month-dates">
                  {datesByMonth[monthName]?.map((dateItem, index) => {
                  const isSelected = isDateSelected(dateItem)
                    const isCurrentDate = isToday(dateItem) && !selectedDate
                    const isValid = isDateValid(dateItem.date)
                    const isScrollingTo = scrollingDate && normalizeDate(scrollingDate).getTime() === normalizeDate(dateItem.date).getTime()
                    const isFirstDate = index === 0
                  
                  return (
                    <div
                      key={`${monthName}-${dateItem.day}`}
                      className="date-line-container"
                    >
                      {isFirstDate && memoryCount > 0 && (
                        <span className="month-memory-count">{memoryCount} {memoryCount === 1 ? 'memory' : 'memories'}</span>
                      )}
                      <div
                        data-date-key={`${monthName}-${dateItem.day}`}
                        data-date-item={`${dateItem.date.getTime()}`}
                        className={`date-line-wrapper ${isSelected ? 'selected' : ''} ${isCurrentDate ? 'current-date' : ''} ${!isValid ? 'disabled' : ''} ${isScrollingTo ? 'scrolling-to' : ''}`}
                        onClick={() => handleDateClick(dateItem)}
                        title={`${monthName} ${dateItem.day}${!isValid ? ' (Not yet available)' : ''}`}
                        style={{ opacity: isValid ? 1 : 0.3, cursor: isValid ? 'pointer' : 'not-allowed' }}
                      >
                        <div className={`date-line ${isSelected ? 'selected' : ''} ${isCurrentDate ? 'current-date' : ''} ${isScrollingTo ? 'scrolling-to' : ''}`}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            )
          })}
        </div>
      </div>

      {/* Video Modal */}
      {showVideoModal && (
        <div className="video-modal-overlay" onClick={closeVideoModal}>
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <button className="video-modal-close" onClick={closeVideoModal}>×</button>
            <div className="video-modal-content">
              <video
                ref={modalVideoRef}
                className="modal-video"
                autoPlay
                loop
                playsInline
                key={modalVideoUrl}
                onError={(e) => {
                  console.error('Video error:', e)
                  console.error('Failed to load video:', modalVideoUrl)
                }}
                onLoadedData={() => {
                  console.log('Video loaded successfully:', modalVideoUrl)
                  if (modalVideoRef.current) {
                    modalVideoRef.current.play().catch(err => {
                      console.error('Error playing video after load:', err)
                    })
                  }
                }}
              >
                <source src={modalVideoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              {/* Logo in bottom right */}
              <img src="/logo.png" alt="Memento" className="video-modal-logo" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

