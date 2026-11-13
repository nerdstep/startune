import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { RepoDetailProvider, RepoRow } from '@/components/repo'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useDerived } from '@/lib/queries'

// Real implementation, counted: RepoRow calls useDerived once per render.
vi.mock('@/lib/queries', { spy: true })

/** The first `count` demo stars as Stars-list rows, with the list's stable callbacks. */
function Rows({ count, onParentRender }: { count: number; onParentRender?: () => void }) {
  const { data } = useDerived()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [tick, setTick] = useState(0)
  const onSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])
  const onHover = useCallback(() => {}, [])
  onParentRender?.()
  return (
    <div>
      <button type="button" onClick={() => setTick(tick + 1)}>
        Re-render list
      </button>
      <button type="button" onClick={() => data && onSelect(data.stars[1]?.id ?? '')}>
        Select the second row
      </button>
      {data?.stars.slice(0, count).map((s) => (
        <RepoRow
          key={s.id}
          s={s}
          selected={selected.has(s.id)}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
      <p style={{ marginTop: 200 }}>Away from the rows</p>
    </div>
  )
}

async function renderRows(count = 5, onParentRender?: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const screen = await render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RepoDetailProvider>
          <Rows count={count} onParentRender={onParentRender} />
        </RepoDetailProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  )
  await expect.element(screen.getByRole('checkbox', { name: /^Select / }).first()).toBeVisible()
  return screen
}

const toolbars = () => document.querySelectorAll('[aria-label="More"]').length

/** The toolbar's opacity: Playwright's "visible" ignores opacity, and the toolbar fades to 0. */
const toolbarOpacity = () => {
  const more = document.querySelector('[aria-label="More"]')?.parentElement
  return more ? getComputedStyle(more).opacity : 'unmounted'
}

describe('RepoRow', () => {
  it('mounts its toolbar only once the row is hovered or focused', async () => {
    const screen = await renderRows()
    expect(toolbars()).toBe(0)

    const names = screen.getByRole('button', { name: /\// })
    await userEvent.hover(names.nth(0))
    await vi.waitFor(() => expect(toolbarOpacity()).toBe('1'))
    expect(toolbars()).toBe(1)

    names.nth(2).element().focus()
    await vi.waitFor(() => expect(toolbars()).toBe(2))
  })

  it('selects from the full-height left strip without opening the repo', async () => {
    const screen = await renderRows()
    const row = document.querySelector('[data-select-zone]')?.parentElement
    if (!row) {
      throw new Error('no row')
    }
    const { height } = row.getBoundingClientRect()

    // The row's bottom-left corner, well outside the 16px checkbox.
    await userEvent.click(page.elementLocator(row), { position: { x: 3, y: height - 3 } })
    await expect.element(screen.getByRole('checkbox', { name: /^Select / }).first()).toBeChecked()
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    // The rest of the row opens the repo.
    const description = row.querySelector('p')
    if (!description) {
      throw new Error('no description')
    }
    // force: the row's name button overlays the description, so the click lands on it, as a real one does.
    await userEvent.click(page.elementLocator(description), { force: true })
    await expect.element(page.getByRole('dialog')).toBeVisible()
  })

  it('keeps the toolbar shown while its menu is open', async () => {
    const screen = await renderRows()
    await userEvent.hover(screen.getByRole('button', { name: /\// }).first())
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    await expect.element(page.getByRole('menuitem', { name: /Open on GitHub/ })).toBeVisible()

    // force: the open menu's backdrop covers the page, as it does for a real pointer moving away.
    await userEvent.hover(screen.getByText('Away from the rows'), { force: true })
    // Past the toolbar's 150ms fade, so a toolbar that is hiding has reached 0.
    await new Promise((r) => setTimeout(r, 300))
    expect(toolbarOpacity()).toBe('1')
  })

  it('skips re-rendering rows whose props did not change', async () => {
    let parentRenders = 0
    const screen = await renderRows(5, () => {
      parentRenders += 1
    })
    const rowRenders = () => vi.mocked(useDerived).mock.calls.length - parentRenders

    // The list re-renders (as it does on every scroll step); unchanged rows stay put.
    let before = rowRenders()
    await userEvent.click(screen.getByRole('button', { name: 'Re-render list' }))
    await vi.waitFor(() => expect(parentRenders).toBeGreaterThan(1))
    expect(rowRenders()).toBe(before)

    // Selecting one row re-renders that row alone.
    before = rowRenders()
    await userEvent.click(screen.getByRole('button', { name: 'Select the second row' }))
    await expect.element(screen.getByRole('checkbox', { name: /^Select / }).nth(1)).toBeChecked()
    expect(rowRenders() - before).toBe(1)
  })
})
