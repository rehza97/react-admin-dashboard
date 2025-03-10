import { useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Divider,
  Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ExpandAllIcon from "@mui/icons-material/UnfoldMore";
import CollapseAllIcon from "@mui/icons-material/UnfoldLess";
import PageLayout from "../../components/PageLayout";
import { useTranslation } from "react-i18next";

const FAQ = () => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : "");
  };

  const handleExpandAll = () => {
    setExpanded("all");
  };

  const handleCollapseAll = () => {
    setExpanded("");
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  const faqItems = [
    {
      id: "general1",
      category: "general",
      question: t("faq.generalQuestion1"),
      answer: t("faq.generalAnswer1"),
    },
    {
      id: "general2",
      category: "general",
      question: t("faq.generalQuestion2"),
      answer: t("faq.generalAnswer2"),
    },
    {
      id: "account1",
      category: "account",
      question: t("faq.accountQuestion1"),
      answer: t("faq.accountAnswer1"),
    },
    {
      id: "account2",
      category: "account",
      question: t("faq.accountQuestion2"),
      answer: t("faq.accountAnswer2"),
    },
    {
      id: "technical1",
      category: "technical",
      question: t("faq.technicalQuestion1"),
      answer: t("faq.technicalAnswer1"),
    },
    {
      id: "technical2",
      category: "technical",
      question: t("faq.technicalQuestion2"),
      answer: t("faq.technicalAnswer2"),
    },
  ];

  const filteredFaqs = faqItems.filter(
    (item) =>
      (activeCategory === "all" || item.category === activeCategory) &&
      (searchQuery === "" ||
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categories = [
    { id: "all", label: t("faq.allCategories") },
    { id: "general", label: t("faq.general") },
    { id: "account", label: t("faq.account") },
    { id: "technical", label: t("faq.technical") },
  ];

  const headerAction = (
    <Box sx={{ display: "flex" }}>
      <Button
        startIcon={<ExpandAllIcon />}
        onClick={handleExpandAll}
        sx={{ mr: 1 }}
      >
        {t("faq.expandAll")}
      </Button>
      <Button startIcon={<CollapseAllIcon />} onClick={handleCollapseAll}>
        {t("faq.collapseAll")}
      </Button>
    </Box>
  );

  return (
    <PageLayout
      title={t("faq.frequentlyAskedQuestions")}
      subtitle={t("faq.findAnswers")}
      headerAction={headerAction}
    >
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder={t("faq.searchFAQ")}
          value={searchQuery}
          onChange={handleSearch}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        <Box sx={{ display: "flex", mb: 3 }}>
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              onClick={() => handleCategoryChange(category.id)}
              color={activeCategory === category.id ? "primary" : "default"}
              sx={{ mr: 1, mb: 1 }}
            />
          ))}
        </Box>
      </Box>

      {filteredFaqs.length === 0 ? (
        <Typography variant="body1" sx={{ textAlign: "center", py: 4 }}>
          {t("faq.noResults")}
        </Typography>
      ) : (
        filteredFaqs.map((faq) => (
          <Accordion
            key={faq.id}
            expanded={expanded === faq.id || expanded === "all"}
            onChange={handleChange(faq.id)}
            sx={{ mb: 2 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`${faq.id}-content`}
              id={`${faq.id}-header`}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {faq.question}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body1">{faq.answer}</Typography>
              <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                <Typography variant="body2" color="text.secondary">
                  {t("faq.helpfulAnswer")}
                </Typography>
                <Button size="small" sx={{ ml: 1 }}>
                  {t("faq.yes")}
                </Button>
                <Button size="small">{t("faq.no")}</Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      <Divider sx={{ my: 4 }} />

      <Box sx={{ textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          {t("faq.moreQuestions")}
        </Typography>
        <Button variant="contained" color="primary">
          {t("faq.contactSupport")}
        </Button>
      </Box>
    </PageLayout>
  );
};

export default FAQ;
