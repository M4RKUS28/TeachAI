import { useState, useEffect } from 'react';
import { ActionIcon, Box, Tabs, useMantineTheme } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import { IconChartLine, IconMessage, IconChevronLeft, IconNote, IconTool } from '@tabler/icons-react';
import { Resizable } from 're-resizable';
import GeoGebraPlotter from './GeoGebraPlotter';
import ChatTool from './ChatTool';
import NotesTool from './NotesTool';
import { useToolbar } from '../../contexts/ToolbarContext';
import { TOOL_TABS } from './ToolUtils';
import './Toolbar.css';

import { IconChevronRight  } from '@tabler/icons-react';

/**
 * ToolbarContainer component
 * Container for interactive learning tools with a resizable sidebar
 */
function ToolbarContainer({ courseId, chapterId }) {
  const { t } = useTranslation('toolbarContainer');  
  const theme = useMantineTheme();  
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDesktop = !isMobile;
  const { toolbarOpen, setToolbarOpen, toolbarWidth, setToolbarWidth } = useToolbar();
  const [activeTab, setActiveTab] = useState(TOOL_TABS.CHAT); // Use constant for tab value

  useEffect(() => {
    // Handle toolbar width based on screen size and state
    if (!toolbarOpen) {
      // When closed, maintain stored width but toolbar is hidden on mobile
      console.log('Toolbar closed, maintaining width at:', toolbarWidth);
    } else {
      // When opened, adjust width based on screen size
      if (isMobile) {
        // On mobile, use smaller width - about 80% of screen width max, but reasonable minimum
        const maxMobileWidth = Math.min(280, window.innerWidth * 0.8);
        const minMobileWidth = 200; // Minimum usable width
        
        if (toolbarWidth <= 40 || toolbarWidth > maxMobileWidth) {
          setToolbarWidth(Math.max(minMobileWidth, Math.min(260, maxMobileWidth)));
        }
      } else {
        // On desktop, ensure reasonable minimum width
        if (toolbarWidth <= 40) {
          setToolbarWidth(500);
        }
      }
      console.log('Toolbar open with width:', toolbarWidth);
    }
  }, [toolbarOpen, toolbarWidth, setToolbarWidth, isMobile]);

  const handleToggleToolbar = () => {
    setToolbarOpen(!toolbarOpen);
  };

  const handleTabChange = (value) => {
    console.log('Tab change requested:', value);
    setActiveTab(value);
    
    // Always ensure toolbar is open when changing tabs
    if (!toolbarOpen) {
      setToolbarOpen(true);
    }
    
    // Make sure we're using the correct tab value
    if (value !== TOOL_TABS.PLOTTER && value !== TOOL_TABS.CHAT && value !== TOOL_TABS.NOTES) {
      console.warn('Unknown tab value:', value);
    } else {
      console.log('Changed tab to:', value); 
    }
  };
  return (
    <>
      {/* Desktop floating toggle button - only visible when toolbar is closed */}
      {!isMobile && !toolbarOpen && (
        <ActionIcon
          size="lg"
          variant="filled"
          color="blue"
          onClick={handleToggleToolbar}
          sx={{
            position: 'fixed',
            bottom: '32px',
            right: '32px',
            zIndex: 150,
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: theme.colorScheme === 'dark' 
              ? '0 4px 12px rgba(0, 0, 0, 0.4)' 
              : '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'transform 0.2s ease',
            '&:hover': {
              transform: 'scale(1.1)'
            }
          }}
        >
          <IconChevronLeft size={24} aria-label={t('buttons.openToolbar')} />
        </ActionIcon>
      )}

      {/* Mobile floating toggle button - always visible on mobile */}
      {isMobile && (
        <ActionIcon
          size="lg"
          variant="filled"
          color="blue"
          onClick={handleToggleToolbar}          sx={{ 
            position: 'fixed',
            top: '90px',
            right: '20px',
            zIndex: 150, // Lower than user menu dropdown (300) but higher than toolbar (100)
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: theme.colorScheme === 'dark' 
              ? '0 4px 12px rgba(0, 0, 0, 0.4)' 
              : '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          {toolbarOpen 
            ? <IconChevronRight size={22} aria-label={t('buttons.closeToolbar')} /> 
            : activeTab === TOOL_TABS.PLOTTER ? <IconChartLine size={22} aria-label={t('buttons.openPlotter')} /> 
            : activeTab === TOOL_TABS.CHAT ? <IconMessage size={22} aria-label={t('buttons.openChat')} /> 
            : <IconTool size={22} aria-label={t('buttons.openNotes')} />
          }
        </ActionIcon>
      )}
        <Resizable      
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            paddingTop: '16px',
            borderLeft: `1px solid ${theme.colorScheme === 'dark' ? theme.colors.dark[4] : '#e9ecef'}`,
            backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[7] : '#f8f9fa',
            overflow: 'hidden',
            zIndex: 100,
            // Completely hide on mobile when closed, only show toggle button
            display: (isMobile && !toolbarOpen) ? 'none' : 'flex',
            flexDirection: 'column',
            boxShadow: toolbarOpen ? (theme.colorScheme === 'dark' 
              ? '-2px 0 10px rgba(0, 0, 0, 0.3)' 
              : '-2px 0 10px rgba(0, 0, 0, 0.1)')
              : 'none',
            transition: 'width 0.3s ease, box-shadow 0.3s ease',
          }}
          size={{ 
            width: toolbarOpen ? (isMobile ? '100vw' : toolbarWidth) : (isMobile ? 0 : 40)
          }}
          minWidth={isMobile ? (toolbarOpen ? '100vw' : 0) : 40}
          maxWidth={isMobile ? '100vw' : '80vw'}
          enable={{
            top: false,
            right: false,
            bottom: false,
            left: toolbarOpen && !isMobile,
            topRight: false,
            bottomRight: false,
            bottomLeft: false,
            topLeft: false,      }}onResizeStart={() => {
            // Set a resize class on body to disable transitions during resize
            document.body.classList.add('resizing-toolbar');
          }}
          onResize={() => {
            // Do nothing during resize to prevent erratic behavior
            // We'll only update at the end of resize
          }}      
          onResizeStop={(e, direction, ref) => {
            // Update width once at the end of resizing to prevent erratic behavior
            const newWidth = isMobile 
              ? Math.max(200, Math.min(280, parseInt(ref.style.width, 10)))
              : Math.max(40, Math.min(800, parseInt(ref.style.width, 10)));
            setToolbarWidth(newWidth);
            document.body.classList.remove('resizing-toolbar');
            console.log('Toolbar width updated to:', newWidth);

          }}
          handleStyles={{
            left: {
              width: '6px',
              left: '0',
              cursor: 'col-resize',
              backgroundColor: theme.colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              '&:hover': {
                backgroundColor: theme.colorScheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              },
            }
          }}
          handleClasses={{
            left: 'splitter-handle-left'
          }}
        >
      {/* Toggle button and tab selection */}
      <Box sx={{ 
        position: 'absolute', 
        top: '20px', 
        left: '0', 
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '10px',
      }}>
        <ActionIcon
          size="lg"
          variant="filled"
          color="blue"
          onClick={handleToggleToolbar}
          sx={{ 
            borderRadius: '0 4px 4px 0',
            width: '40px',
            height: '40px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: (theme.colorScheme === 'dark' 
              ? '-2px 0 5px rgba(0, 0, 0, 0.3)' 
              : '-2px 0 5px rgba(0, 0, 0, 0.1)')
          }}
        >          {toolbarOpen            ? <IconChevronLeft size={20} aria-label={t('buttons.closeToolbar')} /> 
            : activeTab === TOOL_TABS.PLOTTER ? <IconChartLine size={20} aria-label={t('buttons.openPlotter')} /> 
            : activeTab === TOOL_TABS.CHAT ? <IconMessage size={20} aria-label={t('buttons.openChat')} /> 
            : <IconNote size={20} aria-label={t('buttons.openNotes')} />
          }
        </ActionIcon>        {toolbarOpen && (
          <Tabs 
            value={activeTab} 
            onTabChange={handleTabChange} 
            orientation="vertical"
            sx={{ 
              position: 'absolute',
              top: '70px', // Position below toggle button
              left: 0,
              zIndex: 11
            }}
          >
            <Tabs.List>             
            <Tabs.Tab 
                value={TOOL_TABS.CHAT}
                icon={<IconMessage size={20} />} aria-label={t('tabs.chat')}
                sx={{
                  borderRadius: '0 4px 4px 0',
                   marginBottom: '15px'

                }}
              />

              <Tabs.Tab 
                value={TOOL_TABS.PLOTTER}
                icon={<IconChartLine size={20} />} aria-label={t('tabs.plotter')}
                sx={{
                  borderRadius: '0 4px 4px 0',
                  marginTop: '15px',
                  marginBottom: '15px'
                }}
              />

              <Tabs.Tab 
                value={TOOL_TABS.NOTES}
                icon={<IconNote size={20} />} aria-label={t('tabs.notes')}
                sx={{
                  borderRadius: '0 4px 4px 0',
                  marginBottom: '15px'
                }}
              />
            </Tabs.List>
          </Tabs>
        )}</Box>
        {/* Tool Content Area */}        <div style={{
        width: '100%',
        overflow: 'auto', // Allow content to scroll independently
        position: 'relative',
        paddingTop: '40px', // Add space for the toggle button
        backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[7] : '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
      }} className="tool-content"> 
        {activeTab === TOOL_TABS.PLOTTER && (
          <GeoGebraPlotter isOpen={toolbarOpen} />
        )}
        
        {activeTab === TOOL_TABS.CHAT && (
          <ChatTool 
            isOpen={toolbarOpen} 
            courseId={courseId} 
            chapterId={chapterId} 
          />
        )}
        
        {activeTab === TOOL_TABS.NOTES && (
          <NotesTool isOpen={toolbarOpen} courseId={courseId} chapterId={chapterId} />        )}
      </div>
    </Resizable>
    </>
  );
}

export default ToolbarContainer;