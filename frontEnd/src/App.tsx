import { useState, useMemo, useRef, useEffect } from 'react'
import { Bell, Upload, FileText } from 'lucide-react'
import './App.css'

interface DateItem {
  date: Date
  day: number
  month: number
  year: number
  monthName: string
}

function App() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [scrollingDate, setScrollingDate] = useState<Date | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false)
  const [isDateSliderHidden, setIsDateSliderHidden] = useState(false)
  const [audioData, setAudioData] = useState<number[]>([])
  const [isCenterImageHeld, setIsCenterImageHeld] = useState(false)
  const [borderProgress, setBorderProgress] = useState(0)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [pixelRevealProgress, setPixelRevealProgress] = useState(0)
  const sliderRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const hasCentered = useRef(false)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const hasMoved = useRef(false)
  const clickTarget = useRef<HTMLElement | null>(null)
  const justDragged = useRef(false)
  const imageClickStarts = useRef<Map<string, { x: number; y: number; time: number }>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isVisualizingRef = useRef(false)
  const centerImageHoldTimer = useRef<number | null>(null)
  const borderAnimationFrame = useRef<number | null>(null)
  const pixelRevealTimer = useRef<number | null>(null)

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

  // Generate dates for all 12 months (use current year)
  const allDates = useMemo(() => {
    const dateList: DateItem[] = []
    const year = today.getFullYear()

    for (let month = 0; month < 12; month++) {
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day)
        dateList.push({
          date,
          day,
          month,
          year,
          monthName: date.toLocaleDateString('en-US', { month: 'long' }),
        })
      }
    }

    return dateList
  }, [today])

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

  // Filter months to only show those that have valid dates (up to Nov 9th)
  const displayMonths = useMemo(() => {
    return allMonthNames.filter(monthName => {
      const monthDates = datesByMonth[monthName]
      return monthDates && monthDates.length > 0
    })
  }, [datesByMonth, allMonthNames])

  // Get date day number to display for each month (only show circle for selected date, not today)
  const getCurrentDateForMonth = (monthName: string): number | null => {
    const monthIndex = allMonthNames.indexOf(monthName)
    if (monthIndex === -1) return null
    
    const currentYear = today.getFullYear()
    
    // Only show circle if there's a selected date in this month
    if (selectedDate) {
      const normalizedSelected = normalizeDate(selectedDate)
      const selectedMonth = normalizedSelected.getMonth()
      const selectedYear = normalizedSelected.getFullYear()
      if (selectedMonth === monthIndex && selectedYear === currentYear) {
        return normalizedSelected.getDate()
      }
    }
    
    return null
  }

  // Count memories (images) for each month
  const getMemoryCountForMonth = (monthName: string): number => {
    const monthIndex = allMonthNames.indexOf(monthName)
    if (monthIndex === -1) return 0
    
    const currentYear = today.getFullYear()
    
    // Count images that have dates in this month and are valid (up to Nov 9th)
    return sampleImages.filter(img => {
      const imgDate = normalizeDate(img.date)
      return imgDate.getMonth() === monthIndex && 
             imgDate.getFullYear() === currentYear &&
             isDateValid(imgDate)
    }).length
  }

  // Get current year
  const currentYear = today.getFullYear()

  // Normalize dates to midnight for comparison
  const normalizeDate = (d: Date): Date => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  // Get cutoff date (November 9th of current year)
  const cutoffDate = useMemo(() => {
    return new Date(currentYear, 10, 9) // November 9th (month is 0-indexed, so 10 = November)
  }, [currentYear])

  // Check if a date is valid (up to November 9th of current year)
  const isDateValid = (date: Date): boolean => {
    const normalizedDate = normalizeDate(date)
    return normalizedDate <= cutoffDate && normalizedDate.getFullYear() === currentYear
  }

  // Sample image data with URLs, dates, and captions
  // Note: Dates should be valid (up to November 9th) to show date labels
  const sampleImages = useMemo(() => {
    const year = currentYear
    return [
      {
        url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
        date: new Date(year, 9, 3), // October 3rd
        caption: 'Mountain Adventure'
      },
      {
        url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop',
        date: new Date(year, 9, 15), // October 15th
        caption: 'Sunset Memories'
      },
      {
        url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop',
        date: new Date(year, 10, 5), // November 5th
        caption: 'Forest Walk'
      },
      {
        url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
        date: new Date(year, 10, 9), // November 9th
        caption: 'Final Day'
      },
    ]
  }, [currentYear])

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

  // Get ordered images (center, left, right)
  const orderedImages = useMemo(() => {
    if (sampleImages.length === 0) return []
    
    const leftIndex = (centerImageIndex - 1 + sampleImages.length) % sampleImages.length
    const rightIndex = (centerImageIndex + 1) % sampleImages.length
    
    return [
      { ...sampleImages[leftIndex], position: 'left' as const },
      { ...sampleImages[centerImageIndex], position: 'center' as const },
      { ...sampleImages[rightIndex], position: 'right' as const },
    ]
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

  // Handle center image click - only toggles voice input, doesn't affect image/date selection
  const handleCenterImageClick = (e?: React.MouseEvent) => {
    // Prevent any event propagation that might trigger other handlers
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    
    // Only toggle voice input, don't change any image/date selection state
    if (isVoiceInputActive) {
      // If voice input is already active, close it
      stopVoiceInput()
    } else {
      // Hide date slider and show voice input
      setIsDateSliderHidden(true)
      setIsVoiceInputActive(true)
      startVoiceInput()
    }
  }

  // Start voice input and microphone
  const startVoiceInput = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      // Create analyser node
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser

      // Create microphone source
      const microphone = audioContext.createMediaStreamSource(stream)
      microphoneRef.current = microphone
      microphone.connect(analyser)

      // Start visualization
      visualizeAudio()
    } catch (error) {
      console.error('Error accessing microphone:', error)
      // If microphone access fails, still show the UI but without audio visualization
      setIsVoiceInputActive(true)
    }
  }

  // Stop voice input and cleanup
  const stopVoiceInput = () => {
    // Stop audio visualization
    isVisualizingRef.current = false
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Clear refs
    analyserRef.current = null
    microphoneRef.current = null
    setAudioData([])

    // Hide voice input and show date slider
    setIsVoiceInputActive(false)
    setIsDateSliderHidden(false)
  }

  // Visualize audio data
  const visualizeAudio = () => {
    if (!analyserRef.current) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    isVisualizingRef.current = true

    const updateVisualization = () => {
      if (!analyserRef.current || !isVisualizingRef.current) {
        return
      }

      analyserRef.current.getByteFrequencyData(dataArray)

      // Convert to array and normalize (0-100)
      const normalizedData = Array.from(dataArray).slice(0, 40).map(value => (value / 255) * 100)
      setAudioData(normalizedData)

      animationFrameRef.current = requestAnimationFrame(updateVisualization)
    }

    updateVisualization()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceInput()
      if (centerImageHoldTimer.current) {
        clearTimeout(centerImageHoldTimer.current)
      }
      if (borderAnimationFrame.current) {
        cancelAnimationFrame(borderAnimationFrame.current)
      }
      if (pixelRevealTimer.current) {
        clearInterval(pixelRevealTimer.current)
      }
    }
  }, [])

  // Border animation when center image is held (works even during drag)
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
        // Border complete - show video modal
        setShowVideoModal(true)
        setIsCenterImageHeld(false)
        setBorderProgress(0)
        startPixelReveal()
      }
    }

    borderAnimationFrame.current = requestAnimationFrame(animate)

    return () => {
      if (borderAnimationFrame.current) {
        cancelAnimationFrame(borderAnimationFrame.current)
      }
    }
  }, [isCenterImageHeld])

  // Pixel reveal animation for video modal
  const startPixelReveal = () => {
    setPixelRevealProgress(0)
    const PIXEL_REVEAL_DURATION = 10000 // 10 seconds
    const startTime = Date.now()

    pixelRevealTimer.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(100, (elapsed / PIXEL_REVEAL_DURATION) * 100)
      setPixelRevealProgress(progress)

      if (progress >= 100) {
        if (pixelRevealTimer.current) {
          clearInterval(pixelRevealTimer.current)
          pixelRevealTimer.current = null
        }
      }
    }, 16) // ~60fps
  }

  const closeVideoModal = () => {
    setShowVideoModal(false)
    setPixelRevealProgress(0)
    if (pixelRevealTimer.current) {
      clearInterval(pixelRevealTimer.current)
      pixelRevealTimer.current = null
    }
  }

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

      // For center image, don't start dragging immediately - wait for movement
      // This allows border animation to work while holding
      e.preventDefault()
      e.stopPropagation()
      justDragged.current = false // Reset drag flag
      
      // Set hold state for border animation (in case React handler didn't fire)
      if (position === 'center') {
        setIsCenterImageHeld(true)
      }
      
      cardDragState.current = {
        isDragging: false, // Start as false, will be set to true on movement
        cardPosition: position,
        cardElement: cardElement,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      }
      // Don't change cursor or styles yet - let border animation work
      cardElement.style.pointerEvents = 'auto' // Ensure pointer events work
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
      
      // Stop hold state for center image (in case React handler didn't fire)
      if (position === 'center') {
        setIsCenterImageHeld(false)
      }
      
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
      
      // Set hold state for center image border animation
      if (position === 'center') {
        setIsCenterImageHeld(true)
      }
      
      cardDragState.current = {
        isDragging: false, // Start as false, will be set to true on movement
        cardPosition: position,
        cardElement: cardElement,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
      }
      // Don't disable transition yet - let border animation work
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
      const position = cardDragState.current.cardPosition
      
      // Stop hold state for center image
      if (position === 'center') {
        setIsCenterImageHeld(false)
      }
      
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

      {/* Left Sidebar */}
      <aside className="sidebar">
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
      <header className="header">
        <div className="header-center">
          <h1 className="app-title">Memento</h1>
        </div>
      </header>

      {/* Main Content - Three Image Slots */}
      <div className="image-container" ref={imageContainerRef}>
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
          
          // Handle click on left/right images to center them
          const imageKey = `${image.url}-${image.position}-${image.date.getTime()}`
          
          const handleSlotMouseDown = (e: React.MouseEvent) => {
            // Track for all images (including center)
            // Stop propagation to prevent native drag handlers from interfering immediately
            if (image.position !== 'center') {
              e.stopPropagation()
            }
            imageClickStarts.current.set(imageKey, {
              x: e.clientX,
              y: e.clientY,
              time: Date.now()
            })

            // For center image, start hold detection
            if (image.position === 'center') {
              setIsCenterImageHeld(true)
            }
          }
          
          const handleSlotMouseUp = (e: React.MouseEvent) => {
            const clickStart = imageClickStarts.current.get(imageKey)
            
            // Stop hold detection for center image
            if (image.position === 'center') {
              setIsCenterImageHeld(false)
            }
            
            // Check if this was a click (mouse didn't move much)
            if (clickStart) {
              const movedDistance = Math.sqrt(
                Math.pow(e.clientX - clickStart.x, 2) +
                Math.pow(e.clientY - clickStart.y, 2)
              )
              
              // For left/right images, prioritize click over drag
              // If mouse moved less than 10px, treat it as a click
              // Use a small delay to check justDragged after drag handlers have run
              setTimeout(() => {
                if (image.position === 'center') {
                  // Center image click only toggles voice input (if not held long enough for border)
                  if (movedDistance < 10 && !justDragged.current && !cardDragState.current.isDragging && borderProgress < 50) {
                    e.stopPropagation()
                    e.preventDefault()
                    handleCenterImageClick(e)
                  }
                } else {
                  // Left/right images: click to center (allow slightly more movement for better click detection)
                  if (movedDistance < 10 && !justDragged.current) {
                    e.stopPropagation()
                    e.preventDefault()
                    handleImageClick(image.date)
                  }
                }
              }, 50)
            }
            
            imageClickStarts.current.delete(imageKey)
          }
          
          const handleSlotClick = (e: React.MouseEvent) => {
            // Direct click handler as fallback for left/right images
            if (image.position !== 'center') {
              e.stopPropagation()
              e.preventDefault()
              // Only handle if it wasn't already handled by mouseup
              const clickStart = imageClickStarts.current.get(imageKey)
              if (!clickStart) {
                handleImageClick(image.date)
              }
            }
          }
          
          // Calculate border animation for center image
          const borderStyle = isCenter && isCenterImageHeld ? {
            '--border-progress': `${borderProgress}%`
          } as React.CSSProperties : {}
          
          return (
            <div 
              key={`${image.url}-${image.position}-${image.date.getTime()}`}
              className={`image-slot image-slot-${image.position} ${animationClass} ${isCenter && isCenterImageHeld ? 'center-image-held' : ''}`}
              style={shouldApplyTransform ? { ...transformStyle, ...borderStyle } : borderStyle}
              onMouseDown={handleSlotMouseDown}
              onMouseUp={handleSlotMouseUp}
              onMouseLeave={() => {
                if (image.position === 'center') {
                  setIsCenterImageHeld(false)
                }
              }}
              onTouchStart={(e) => {
                if (image.position === 'center') {
                  setIsCenterImageHeld(true)
                }
                handleSlotMouseDown(e as any)
              }}
              onTouchEnd={(e) => {
                if (image.position === 'center') {
                  setIsCenterImageHeld(false)
                }
                handleSlotMouseUp(e as any)
              }}
              onClick={handleSlotClick}
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
      <div className={`date-slider ${isDateSliderHidden ? 'date-slider-hidden' : ''}`} ref={sliderRef}>
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
                  <span className="month-name">{monthName} {currentYear}</span>
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

      {/* Voice Input Component */}
      <div className={`voice-input ${isVoiceInputActive ? 'voice-input-active' : ''}`}>
        <div className="voice-input-container">
          <div className="voice-input-header">
            <button className="voice-input-close" onClick={stopVoiceInput}>×</button>
            <h2 className="voice-input-title">Voice Memory</h2>
          </div>
          <div className="voice-visualization">
            {audioData.length > 0 ? (
              audioData.map((value, index) => (
                <div
                  key={index}
                  className="voice-bar"
                  style={{
                    height: `${Math.max(10, value)}%`,
                    animationDelay: `${index * 0.02}s`
                  }}
                />
              ))
            ) : (
              // Show idle bars when no audio data
              Array.from({ length: 40 }).map((_, index) => (
                <div
                  key={index}
                  className="voice-bar voice-bar-idle"
                  style={{
                    animationDelay: `${index * 0.02}s`
                  }}
                />
              ))
            )}
          </div>
          <div className="voice-input-footer">
            <p className="voice-input-status">
              {streamRef.current ? 'Listening...' : 'Requesting microphone access...'}
            </p>
          </div>
        </div>
      </div>

      {/* Video Modal with Pixelated Reveal */}
      {showVideoModal && (
        <div className="video-modal-overlay" onClick={closeVideoModal}>
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <button className="video-modal-close" onClick={closeVideoModal}>×</button>
            <div className="video-modal-content">
              <div className="pixel-grid">
                {Array.from({ length: 400 }, (_, index) => {
                  // Randomize pixel reveal order for organic appearance
                  const randomOrder = (index * 7919) % 400 // Use prime number for pseudo-random distribution
                  const revealTime = (randomOrder / 400) * 10 // 0-10 seconds
                  const shouldShow = revealTime <= (pixelRevealProgress / 100) * 10
                  return (
                    <div
                      key={index}
                      className={`pixel ${shouldShow ? 'pixel-visible' : ''}`}
                      style={{
                        transitionDelay: `${revealTime * 0.1}s`
                      }}
                    />
                  )
                })}
              </div>
              <video
                className="modal-video"
                autoPlay
                muted
                loop
                playsInline
                style={{ opacity: pixelRevealProgress >= 100 ? 1 : 0 }}
              >
                <source src="/hero.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
