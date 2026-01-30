/*
 * Card Component Tests
 * Uncomment when tests are enabled
 */

// import { describe, it, expect, vi } from 'vitest'
// import { render, screen, fireEvent } from '@testing-library/react'
// import { Card, CardHeader, CardContent, CardFooter } from '../Card'

// describe('Card', () => {
//   it('should render with default variant', () => {
//     render(<Card>Card content</Card>)
//     expect(screen.getByText('Card content')).toBeInTheDocument()
//   })

//   it('should apply default styles', () => {
//     render(<Card data-testid="card">Content</Card>)
//     const card = screen.getByTestId('card')
//     expect(card).toHaveClass('bg-white', 'rounded-lg', 'shadow')
//   })

//   describe('variants', () => {
//     it('should apply outlined variant styles', () => {
//       render(<Card variant="outlined" data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).toHaveClass('border', 'border-gray-200')
//     })

//     it('should apply elevated variant styles', () => {
//       render(<Card variant="elevated" data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).toHaveClass('shadow-lg')
//     })

//     it('should apply flat variant styles', () => {
//       render(<Card variant="flat" data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).not.toHaveClass('shadow')
//     })
//   })

//   describe('onClick', () => {
//     it('should support onClick when provided', () => {
//       const handleClick = vi.fn()
//       render(<Card onClick={handleClick} data-testid="card">Content</Card>)
//       fireEvent.click(screen.getByTestId('card'))
//       expect(handleClick).toHaveBeenCalledTimes(1)
//     })

//     it('should apply hover styles when clickable', () => {
//       const handleClick = vi.fn()
//       render(<Card onClick={handleClick} data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).toHaveClass('cursor-pointer', 'hover:shadow-md')
//     })

//     it('should not have hover styles when not clickable', () => {
//       render(<Card data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).not.toHaveClass('cursor-pointer')
//     })
//   })

//   describe('slots', () => {
//     it('should render header, content, and footer slots', () => {
//       render(
//         <Card>
//           <CardHeader>Header</CardHeader>
//           <CardContent>Content</CardContent>
//           <CardFooter>Footer</CardFooter>
//         </Card>
//       )
//       expect(screen.getByText('Header')).toBeInTheDocument()
//       expect(screen.getByText('Content')).toBeInTheDocument()
//       expect(screen.getByText('Footer')).toBeInTheDocument()
//     })

//     it('should render only content without header/footer', () => {
//       render(
//         <Card>
//           <CardContent>Only Content</CardContent>
//         </Card>
//       )
//       expect(screen.getByText('Only Content')).toBeInTheDocument()
//     })
//   })

//   describe('className merging', () => {
//     it('should merge custom className', () => {
//       render(<Card className="custom-class" data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).toHaveClass('custom-class')
//     })

//     it('should preserve default styles with custom className', () => {
//       render(<Card className="custom-class" data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).toHaveClass('custom-class')
//       expect(card).toHaveClass('bg-white')
//     })
//   })

//   describe('padding', () => {
//     it('should apply default padding', () => {
//       render(<Card data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).toHaveClass('p-4')
//     })

//     it('should allow custom padding', () => {
//       render(<Card padding="lg" data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).toHaveClass('p-6')
//     })

//     it('should allow no padding', () => {
//       render(<Card padding="none" data-testid="card">Content</Card>)
//       const card = screen.getByTestId('card')
//       expect(card).toHaveClass('p-0')
//     })
//   })
// })

// describe('CardHeader', () => {
//   it('should render header content', () => {
//     render(<CardHeader>Header Title</CardHeader>)
//     expect(screen.getByText('Header Title')).toBeInTheDocument()
//   })

//   it('should apply header styles', () => {
//     render(<CardHeader data-testid="header">Header</CardHeader>)
//     const header = screen.getByTestId('header')
//     expect(header).toHaveClass('font-semibold', 'border-b')
//   })

//   it('should support actions slot', () => {
//     render(
//       <CardHeader actions={<button>Action</button>}>
//         Header
//       </CardHeader>
//     )
//     expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
//   })
// })

// describe('CardContent', () => {
//   it('should render content', () => {
//     render(<CardContent>Main Content</CardContent>)
//     expect(screen.getByText('Main Content')).toBeInTheDocument()
//   })

//   it('should apply content styles', () => {
//     render(<CardContent data-testid="content">Content</CardContent>)
//     const content = screen.getByTestId('content')
//     expect(content).toHaveClass('py-4')
//   })
// })

// describe('CardFooter', () => {
//   it('should render footer content', () => {
//     render(<CardFooter>Footer Actions</CardFooter>)
//     expect(screen.getByText('Footer Actions')).toBeInTheDocument()
//   })

//   it('should apply footer styles', () => {
//     render(<CardFooter data-testid="footer">Footer</CardFooter>)
//     const footer = screen.getByTestId('footer')
//     expect(footer).toHaveClass('border-t', 'pt-4')
//   })

//   it('should support button alignment', () => {
//     render(<CardFooter align="right" data-testid="footer">Footer</CardFooter>)
//     const footer = screen.getByTestId('footer')
//     expect(footer).toHaveClass('justify-end')
//   })
// })

export {}
